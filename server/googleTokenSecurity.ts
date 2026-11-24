/**
 * Shared hardening helpers for /api/google/exchange + /api/google/refresh.
 * No tokens / secrets in logs or error bodies.
 *
 * Refresh tokens returned to the client are AES-GCM encrypted with a key
 * derived from the server client secret so the raw Google refresh token is
 * not recoverable from the browser blob, and /api/google/refresh cannot proxy
 * arbitrary Google refresh tokens.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import {
  isAllowedRedirectUri,
  type OriginCheckHeaders,
} from './originAllowlist.js'
import { takeRateLimit, type RateLimitResult } from './rateLimit.js'

export const NO_STORE = { 'cache-control': 'private, no-store' } as const

/** Safe OAuth error codes we may echo from Google (never error_description). */
const SAFE_OAUTH_ERRORS = new Set([
  'invalid_grant',
  'invalid_request',
  'invalid_client',
  'unauthorized_client',
  'unsupported_grant_type',
  'redirect_uri_mismatch',
  'access_denied',
  'invalid_scope',
])

const MAX_CODE_LEN = 2048
/** Sealed blobs are larger than raw Google refresh tokens. */
const MAX_REFRESH_TOKEN_LEN = 8192
const MAX_REDIRECT_URI_LEN = 512
/** Legacy HMAC seal (raw token recoverable) — still accepted on refresh once. */
const REFRESH_SEAL_PREFIX_V1 = 'lumina_rt1.'
/** AES-256-GCM seal — current. */
const REFRESH_SEAL_PREFIX_V2 = 'lumina_rt2.'
const RATE_LIMIT_SALT = 'lumina-rate-v1'

function envInt(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Exchange: default 20 / minute / client key. */
export function exchangeRateLimit(clientKey: string): RateLimitResult {
  const max = envInt('GOOGLE_EXCHANGE_RATE_LIMIT_PER_MIN', 20)
  return takeRateLimit(`exchange:${clientKey}`, max, 60_000)
}

/** Refresh: default 30 / minute / client key. */
export function refreshRateLimit(clientKey: string): RateLimitResult {
  const max = envInt('GOOGLE_REFRESH_RATE_LIMIT_PER_MIN', 30)
  return takeRateLimit(`refresh:${clientKey}`, max, 60_000)
}

/**
 * Rate-limit client key that resists header spoofing as much as a single
 * process can without a trusted-proxy hop count.
 *
 * Prefer platform-set client IP headers (X-Real-IP / CF-Connecting-IP /
 * True-Client-IP). Visitors can prepend XFF hops; when those are all we have,
 * take the *last* hop (edge-appended). Do **not** mix Origin into the key —
 * callers control Origin and could mint a fresh bucket per value.
 */
export function clientKeyFromRequest(request: Request): string {
  const platformIp =
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('true-client-ip')?.trim() ||
    ''
  let ip = platformIp.length > 0 ? platformIp.slice(0, 128) : ''
  if (!ip) {
    const xf = request.headers.get('x-forwarded-for')
    if (xf) {
      const hops = xf
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)
      const last = hops[hops.length - 1]
      if (last) ip = last.slice(0, 128)
    }
  }
  const material = ip || 'unknown'
  return createHash('sha256')
    .update(`${RATE_LIMIT_SALT}|${material}`)
    .digest('hex')
    .slice(0, 32)
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

export function isJsonContentType(request: Request): boolean {
  const ct = (request.headers.get('content-type') || '').toLowerCase()
  return ct.startsWith('application/json')
}

/** Map Google token error JSON → safe short code (no tokens / descriptions). */
export function safeOAuthErrorCode(
  payload: Record<string, unknown>,
  fallback = 'upstream_error',
): string {
  const err = payload.error
  if (typeof err === 'string') {
    const code = err.trim().toLowerCase()
    if (SAFE_OAUTH_ERRORS.has(code)) return code
  }
  return fallback
}

export type ExchangeBody =
  | { ok: true; code: string; redirectUri: string }
  | { ok: false; error: string; status: number }

export type RefreshBody =
  | { ok: true; refreshToken: string }
  | { ok: false; error: string; status: number }

/**
 * Validate exchange JSON body: code + allowlisted redirect_uri only.
 * Rejects unexpected grant types; never accepts arbitrary redirect URIs.
 */
export function parseExchangeBody(
  body: unknown,
  headers?: OriginCheckHeaders,
): ExchangeBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_json', status: 400 }
  }
  const record = body as Record<string, unknown>

  // grant_type is server-fixed; reject client attempts to override.
  const grant =
    record.grant_type ?? record.grantType ?? record.grant ?? undefined
  if (grant !== undefined) {
    const g = typeof grant === 'string' ? grant.trim() : ''
    if (g !== 'authorization_code') {
      return { ok: false, error: 'unsupported_grant_type', status: 400 }
    }
  }

  if (typeof record.code !== 'string') {
    return { ok: false, error: 'code_required', status: 400 }
  }
  const code = record.code.trim()
  if (!code) {
    return { ok: false, error: 'code_required', status: 400 }
  }
  if (code.length > MAX_CODE_LEN) {
    return { ok: false, error: 'code_invalid', status: 400 }
  }
  // Auth codes are URL-safe; reject obvious garbage / injection.
  if (/[\s<>"']/.test(code)) {
    return { ok: false, error: 'code_invalid', status: 400 }
  }

  if (typeof record.redirectUri !== 'string' && typeof record.redirect_uri !== 'string') {
    return { ok: false, error: 'redirect_uri_required', status: 400 }
  }
  const redirectRaw =
    typeof record.redirectUri === 'string'
      ? record.redirectUri
      : String(record.redirect_uri)
  const redirectUri = redirectRaw.trim()
  if (!redirectUri) {
    return { ok: false, error: 'redirect_uri_required', status: 400 }
  }
  if (redirectUri.length > MAX_REDIRECT_URI_LEN) {
    return { ok: false, error: 'redirect_uri_invalid', status: 400 }
  }
  if (!isAllowedRedirectUri(redirectUri, headers)) {
    return { ok: false, error: 'redirect_uri_forbidden', status: 403 }
  }

  return { ok: true, code, redirectUri }
}

export function parseRefreshBody(body: unknown): RefreshBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_json', status: 400 }
  }
  const record = body as Record<string, unknown>

  const grant =
    record.grant_type ?? record.grantType ?? record.grant ?? undefined
  if (grant !== undefined) {
    const g = typeof grant === 'string' ? grant.trim() : ''
    if (g !== 'refresh_token') {
      return { ok: false, error: 'unsupported_grant_type', status: 400 }
    }
  }

  const raw =
    typeof record.refreshToken === 'string'
      ? record.refreshToken
      : typeof record.refresh_token === 'string'
        ? record.refresh_token
        : null
  if (raw == null) {
    return { ok: false, error: 'refresh_token_required', status: 400 }
  }
  const refreshToken = raw.trim()
  if (!refreshToken) {
    return { ok: false, error: 'refresh_token_required', status: 400 }
  }
  if (refreshToken.length > MAX_REFRESH_TOKEN_LEN) {
    return { ok: false, error: 'refresh_token_invalid', status: 400 }
  }
  if (/[\s<>"']/.test(refreshToken)) {
    return { ok: false, error: 'refresh_token_invalid', status: 400 }
  }

  return { ok: true, refreshToken }
}

/** Success token JSON — only expected fields; never forward unknown Google keys. */
export function tokenSuccessBody(
  payload: Record<string, unknown>,
  opts: { includeRefresh: boolean; sealSecret?: string },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    accessToken: typeof payload.access_token === 'string' ? payload.access_token : null,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : null,
    scope: typeof payload.scope === 'string' ? payload.scope : null,
    tokenType: typeof payload.token_type === 'string' ? payload.token_type : null,
  }
  if (opts.includeRefresh) {
    const raw =
      typeof payload.refresh_token === 'string' ? payload.refresh_token : null
    if (raw && opts.sealSecret) {
      body.refreshToken = sealRefreshToken(raw, opts.sealSecret)
    } else {
      body.refreshToken = raw
    }
  }
  return body
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromB64url(value: string): Buffer | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return Buffer.from(padded + pad, 'base64')
  } catch {
    return null
  }
}

function deriveSealKey(secret: string): Buffer {
  return scryptSync(secret, 'lumina-refresh-v2', 32)
}

/** Encrypt a Google refresh token (AES-256-GCM) for client storage. */
export function sealRefreshToken(raw: string, secret: string): string {
  const iv = randomBytes(12)
  const key = deriveSealKey(secret)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${REFRESH_SEAL_PREFIX_V2}${b64url(Buffer.concat([iv, tag, enc]))}`
}

function unsealV2(sealed: string, secret: string): string | null {
  const rest = sealed.slice(REFRESH_SEAL_PREFIX_V2.length)
  const buf = fromB64url(rest)
  if (!buf || buf.length < 12 + 16 + 1) return null
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveSealKey(secret), iv)
    decipher.setAuthTag(tag)
    const raw = Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    )
    if (!raw || raw.length > MAX_REFRESH_TOKEN_LEN) return null
    return raw
  } catch {
    return null
  }
}

/** Legacy v1 HMAC seal (plaintext recoverable) — migrate on next refresh. */
function unsealV1(sealed: string, secret: string): string | null {
  const rest = sealed.slice(REFRESH_SEAL_PREFIX_V1.length)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = rest.slice(0, dot)
  const mac = rest.slice(dot + 1)
  const rawBuf = fromB64url(payload)
  const macBuf = fromB64url(mac)
  if (!rawBuf || !macBuf) return null
  const raw = rawBuf.toString('utf8')
  if (!raw || raw.length > MAX_REFRESH_TOKEN_LEN) return null
  const expected = createHmac('sha256', secret)
    .update(`lumina_rt1|${raw}`)
    .digest()
  if (expected.length !== macBuf.length) return null
  if (!timingSafeEqual(expected, macBuf)) return null
  return raw
}

/**
 * Unwrap a sealed refresh token. Returns null for raw Google tokens or
 * tampered blobs — callers should treat that as reconnect_required.
 */
export function unsealRefreshToken(
  sealed: string,
  secret: string,
): string | null {
  if (!secret || !sealed) return null
  if (sealed.startsWith(REFRESH_SEAL_PREFIX_V2)) return unsealV2(sealed, secret)
  if (sealed.startsWith(REFRESH_SEAL_PREFIX_V1)) return unsealV1(sealed, secret)
  return null
}
