/**
 * Hardening helpers for /api/capture/* (transcribe + Twilio webhook).
 * No secrets in logs or error bodies.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { takeRateLimit, type RateLimitResult } from './rateLimit.js'
import { clientKeyFromRequest, NO_STORE } from './googleTokenSecurity.js'

export { NO_STORE, clientKeyFromRequest }

/** Default Whisper upload cap (OpenAI accepts up to 25MB; we stay under). */
export const DEFAULT_TRANSCRIBE_MAX_BYTES = 5 * 1024 * 1024

/** Short-lived capture CSRF / nonce TTL. */
const CAPTURE_TOKEN_TTL_MS = 5 * 60 * 1000

type CaptureTokenEntry = {
  expiresAt: number
  clientKey: string
}

const captureTokens = new Map<string, CaptureTokenEntry>()

let lastTokenPrune = 0

function pruneCaptureTokens(now = Date.now()): void {
  if (now - lastTokenPrune < 30_000) return
  lastTokenPrune = now
  for (const [token, entry] of captureTokens) {
    if (entry.expiresAt <= now) captureTokens.delete(token)
  }
}

function envInt(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function transcribeMaxBytes(): number {
  return envInt('CAPTURE_TRANSCRIBE_MAX_BYTES', DEFAULT_TRANSCRIBE_MAX_BYTES)
}

/**
 * Who may spend the owner's Whisper/OpenAI key.
 * Fail-closed: empty allowlists → speech-to-text spend is disabled
 * (paste transcript still works). Public Google sign-in alone is not enough.
 *
 * Env (comma / whitespace separated):
 *   CAPTURE_TRANSCRIBE_ALLOWED_EMAILS=you@gmail.com
 *   CAPTURE_TRANSCRIBE_ALLOWED_SUBS=google-subject-id
 */
export function readTranscribeAllowlist(): {
  emails: Set<string>
  subs: Set<string>
  configured: boolean
} {
  const emails = new Set(
    (process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  const subs = new Set(
    (process.env.CAPTURE_TRANSCRIBE_ALLOWED_SUBS ?? '')
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  return { emails, subs, configured: emails.size > 0 || subs.size > 0 }
}

export function isTranscribeCallerAllowed(
  sub: string | null,
  email: string | null,
): boolean {
  const list = readTranscribeAllowlist()
  if (!list.configured) return false
  if (email && list.emails.has(email.toLowerCase())) return true
  if (sub && list.subs.has(sub)) return true
  return false
}

/** True when a Whisper key is bound AND an allowlist is configured. */
export function whisperSpendEnabled(whisperKeyBound: boolean): boolean {
  return whisperKeyBound && readTranscribeAllowlist().configured
}

/**
 * Pre-auth IP budget — runs before Google tokeninfo so forged Bearer tokens
 * cannot fan out unlimited upstream lookups.
 */
export function transcribePreAuthRateLimit(clientKey: string): RateLimitResult {
  const max = envInt('CAPTURE_TRANSCRIBE_PREAUTH_PER_MIN', 12)
  return takeRateLimit(`capture-transcribe-preauth:${clientKey}`, max, 60_000)
}

/** Transcribe: default 3 uploads / minute / Google subject (not spoofable IP). */
export function transcribeCallerRateLimit(sub: string): RateLimitResult {
  const max = envInt('CAPTURE_TRANSCRIBE_RATE_LIMIT_PER_MIN', 3)
  const key = sub.trim() || 'unknown-sub'
  return takeRateLimit(`capture-transcribe-sub:${key}`, max, 60_000)
}

/** Global budget across all callers — default 40 / rolling day. */
export function transcribeGlobalRateLimit(): RateLimitResult {
  const max = envInt('CAPTURE_TRANSCRIBE_GLOBAL_PER_DAY', 40)
  return takeRateLimit('capture-transcribe-global', max, 24 * 60 * 60 * 1000)
}

/** @deprecated Prefer transcribeCallerRateLimit(sub) — IP keys are spoofable. */
export function transcribeRateLimit(clientKey: string): RateLimitResult {
  const max = envInt('CAPTURE_TRANSCRIBE_RATE_LIMIT_PER_MIN', 3)
  return takeRateLimit(`capture-transcribe:${clientKey}`, max, 60_000)
}

/** Status (nonce mint): default 60 / minute / client key. */
export function captureStatusRateLimit(clientKey: string): RateLimitResult {
  const max = envInt('CAPTURE_STATUS_RATE_LIMIT_PER_MIN', 60)
  return takeRateLimit(`capture-status:${clientKey}`, max, 60_000)
}

export function rateLimitedResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: 'rate_limited' },
    {
      status: 429,
      headers: {
        ...NO_STORE,
        'retry-after': String(result.retryAfterSec),
      },
    },
  )
}

/**
 * Mint a short-lived one-shot token for POST /api/capture/transcribe.
 * Issued only from an origin-gated status endpoint so trivial cross-origin
 * scripting cannot mint + spend without a same-origin browser flow.
 */
export function mintCaptureToken(clientKey: string): string {
  pruneCaptureTokens()
  const token = randomBytes(24).toString('base64url')
  captureTokens.set(token, {
    expiresAt: Date.now() + CAPTURE_TOKEN_TTL_MS,
    clientKey,
  })
  return token
}

/**
 * Consume a capture token. One-shot; rejects expired / unknown / wrong client.
 * Returns true when valid.
 */
export function consumeCaptureToken(
  token: string | null | undefined,
  clientKey: string,
): boolean {
  if (!token || token.length < 16 || token.length > 128) return false
  pruneCaptureTokens()
  const entry = captureTokens.get(token)
  if (!entry) return false
  captureTokens.delete(token)
  if (entry.expiresAt <= Date.now()) return false
  // Soft client binding — allow if either side is "unknown" (some edges omit IP).
  if (
    entry.clientKey !== 'unknown' &&
    clientKey !== 'unknown' &&
    entry.clientKey !== clientKey
  ) {
    return false
  }
  return true
}

/** Test helper. */
export function resetCaptureTokens(): void {
  captureTokens.clear()
  lastTokenPrune = 0
}

export function readCaptureTokenHeader(request: Request): string | null {
  const header =
    request.headers.get('x-lumina-capture-token') ??
    request.headers.get('x-capture-token')
  const trimmed = header?.trim()
  return trimmed && trimmed.length ? trimmed : null
}

/**
 * Verify Twilio `X-Twilio-Signature` (HMAC-SHA1 of URL + sorted params).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(opts: {
  authToken: string
  signature: string | null
  url: string
  params: Record<string, string>
}): boolean {
  const { authToken, signature, url, params } = opts
  if (!authToken || !signature || !url) return false

  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }

  const expected = createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf8'))
    .digest('base64')

  try {
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Public URL Twilio POSTed to. Prefer PUBLIC_APP_ORIGIN + path so internal
 * request.url hosts do not break signature validation.
 */
export function twilioWebhookUrl(request: Request): string {
  const path = new URL(request.url).pathname
  const published = (process.env.PUBLIC_APP_ORIGIN ?? '').trim().replace(/\/$/, '')
  if (published) {
    return `${published}${path}`
  }
  // Fallback: published Lumina host (same as origin allowlist default).
  return `https://lumina-calendar-f5eb.apps.grok.bot${path}`
}

export function readTwilioAuthToken(): string | null {
  const token = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  return token || null
}
