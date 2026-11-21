/**
 * Shared hardening helpers for /api/google/exchange + /api/google/refresh.
 * No tokens / secrets in logs or error bodies.
 */

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
const MAX_REFRESH_TOKEN_LEN = 4096
const MAX_REDIRECT_URI_LEN = 512

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

/** Prefer edge-forwarded client IP; never throw. */
export function clientKeyFromRequest(request: Request): string {
  const xf = request.headers.get('x-forwarded-for')
  if (xf) {
    const first = xf.split(',')[0]?.trim()
    if (first) return first.slice(0, 128)
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 128)
  // Fallback: coarse key from Origin (still rate-limits a single browser origin).
  const origin = request.headers.get('origin')?.trim()
  if (origin) return `origin:${origin.slice(0, 128)}`
  return 'unknown'
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
  opts: { includeRefresh: boolean },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    accessToken: typeof payload.access_token === 'string' ? payload.access_token : null,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : null,
    scope: typeof payload.scope === 'string' ? payload.scope : null,
    tokenType: typeof payload.token_type === 'string' ? payload.token_type : null,
  }
  if (opts.includeRefresh) {
    body.refreshToken =
      typeof payload.refresh_token === 'string' ? payload.refresh_token : null
  }
  return body
}
