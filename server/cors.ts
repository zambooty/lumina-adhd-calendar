/**
 * CORS for Capacitor WebView → published `/api/*` (cross-origin).
 * Only reflects Origins already on the static app allowlist.
 * No credentials cookies — Cap uses Bearer/body tokens only.
 */
import {
  isAllowedAppOrigin,
  normalizeOrigin,
  type OriginCheckHeaders,
} from './originAllowlist.js'
import { NO_STORE } from './googleTokenSecurity.js'

const CORS_METHODS = 'GET, POST, OPTIONS'
const CORS_HEADERS =
  'Content-Type, Accept, Authorization, X-Lumina-Google-Access-Token, X-Lumina-Capture-Token, X-Capture-Token'

function requestOrigin(request: Request): string | null {
  const raw = request.headers.get('origin')
  if (!raw) return null
  return normalizeOrigin(raw)
}

/** True when request Origin is on the static allowlist (Cap + published + Vite). */
export function isCorsAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  return isAllowedAppOrigin({
    origin,
    referer: request.headers.get('referer'),
    host: request.headers.get('host'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'sec-fetch-site': request.headers.get('sec-fetch-site'),
  } satisfies OriginCheckHeaders)
}

/**
 * CORS + no-store headers for an allowlisted Origin.
 * Empty object when Origin missing/not allowlisted (same-origin browser calls).
 */
export function corsHeadersFor(request: Request): Record<string, string> {
  const origin = requestOrigin(request)
  if (!origin || !isCorsAllowedOrigin(request)) {
    return { ...NO_STORE }
  }
  return {
    ...NO_STORE,
    'access-control-allow-origin': origin,
    'access-control-allow-methods': CORS_METHODS,
    'access-control-allow-headers': CORS_HEADERS,
    'vary': 'Origin',
  }
}

/** Merge CORS onto existing response headers. */
export function withCors(
  request: Request,
  init?: ResponseInit,
): ResponseInit {
  const cors = corsHeadersFor(request)
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(cors)) {
    headers.set(k, v)
  }
  return { ...init, headers }
}

/** JSON response with CORS for Cap cross-origin. */
export function jsonWithCors(
  request: Request,
  body: unknown,
  init?: ResponseInit,
): Response {
  return Response.json(body, withCors(request, init))
}

/** OPTIONS preflight — 204 when Origin allowlisted, else 403. */
export function corsPreflightResponse(request: Request): Response {
  if (!isCorsAllowedOrigin(request) && request.headers.get('origin')) {
    return new Response(null, {
      status: 403,
      headers: { ...NO_STORE },
    })
  }
  // No Origin (non-CORS) — still answer OPTIONS for proxies.
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(request),
  })
}
