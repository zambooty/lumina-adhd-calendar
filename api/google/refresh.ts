import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { readGoogleEnv } from '../../server/googleEnv.js'
import {
  clientKeyFromRequest,
  isJsonContentType,
  parseRefreshBody,
  rateLimitedResponse,
  refreshRateLimit,
  safeOAuthErrorCode,
  sealRefreshToken,
  tokenSuccessBody,
  unsealRefreshToken,
} from '../../server/googleTokenSecurity.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

/**
 * POST /api/google/refresh — refresh_token → access_token.
 * Allowlisted app origins only. Used after mobile code exchange stored a
 * refresh token. CORS for Capacitor → published API.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return jsonWithCors(request, { error: 'forbidden_origin' }, { status: 403 })
  }

  const limit = refreshRateLimit(clientKeyFromRequest(request))
  if (!limit.allowed) {
    const limited = rateLimitedResponse(limit)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
  }

  if (!isJsonContentType(request)) {
    return jsonWithCors(
      request,
      { error: 'invalid_content_type' },
      { status: 415 },
    )
  }

  const env = readGoogleEnv()
  if (!env.configured || !env.clientId) {
    return jsonWithCors(
      request,
      { error: 'google_not_configured', demoMode: true },
      { status: 503 },
    )
  }
  if (!env.hasClientSecret) {
    return jsonWithCors(
      request,
      { error: 'client_secret_missing' },
      { status: 503 },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonWithCors(request, { error: 'invalid_json' }, { status: 400 })
  }

  const parsed = parseRefreshBody(raw)
  if (!parsed.ok) {
    return jsonWithCors(
      request,
      { error: parsed.error },
      { status: parsed.status },
    )
  }

  const secret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  // Only accept refresh tokens this app sealed after /exchange — blocks using
  // this route as an open proxy for arbitrary Google refresh tokens.
  const refreshToken = unsealRefreshToken(parsed.refreshToken, secret)
  if (!refreshToken) {
    return jsonWithCors(
      request,
      {
        error: 'reconnect_required',
        hint: 'Connect Google again — stored refresh is missing or not issued by this app.',
      },
      { status: 401 },
    )
  }

  const params = new URLSearchParams({
    client_id: env.clientId,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  let tokenRes: Response
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
  } catch {
    return jsonWithCors(
      request,
      { error: 'token_refresh_failed' },
      { status: 502 },
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = (await tokenRes.json()) as Record<string, unknown>
  } catch {
    return jsonWithCors(
      request,
      { error: 'token_refresh_failed' },
      { status: 502 },
    )
  }

  if (!tokenRes.ok) {
    return jsonWithCors(
      request,
      {
        error: 'token_refresh_failed',
        details: safeOAuthErrorCode(payload, 'upstream_error'),
      },
      { status: 502 },
    )
  }

  const body = tokenSuccessBody(payload, { includeRefresh: false })
  if (typeof body.accessToken !== 'string' || !body.accessToken) {
    return jsonWithCors(
      request,
      { error: 'token_refresh_failed' },
      { status: 502 },
    )
  }

  // Always return a fresh AES-sealed blob so legacy HMAC seals migrate.
  body.refreshToken = sealRefreshToken(refreshToken, secret)

  return jsonWithCors(request, body)
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
