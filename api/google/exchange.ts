import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { readGoogleEnv } from '../../server/googleEnv.js'
import {
  clientKeyFromRequest,
  exchangeRateLimit,
  isJsonContentType,
  parseExchangeBody,
  rateLimitedResponse,
  safeOAuthErrorCode,
  tokenSuccessBody,
} from '../../server/googleTokenSecurity.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

/**
 * POST /api/google/exchange — auth-code → token exchange.
 * Allowlisted app origins only. Primary Connect Google flow uses GIS token
 * client (no exchange); mobile redirect OAuth requires this route.
 *
 * Hardening: static origin allowlist, allowlisted redirect_uri only,
 * grant_type fixed to authorization_code, rate limit, no token leakage
 * in error bodies. CORS for Capacitor https://localhost → published API.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return jsonWithCors(request, { error: 'forbidden_origin' }, { status: 403 })
  }

  const limit = exchangeRateLimit(clientKeyFromRequest(request))
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
      {
        error: 'client_secret_missing',
        hint: 'Token-client (GIS) flow does not need this route; bind GOOGLE_CLIENT_SECRET for code exchange.',
      },
      { status: 503 },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonWithCors(request, { error: 'invalid_json' }, { status: 400 })
  }

  const parsed = parseExchangeBody(raw, {
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    host: request.headers.get('host'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
  })
  if (!parsed.ok) {
    return jsonWithCors(
      request,
      { error: parsed.error },
      { status: parsed.status },
    )
  }

  const secret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  const params = new URLSearchParams({
    code: parsed.code,
    client_id: env.clientId,
    client_secret: secret,
    redirect_uri: parsed.redirectUri,
    grant_type: 'authorization_code',
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
      { error: 'token_exchange_failed' },
      { status: 502 },
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = (await tokenRes.json()) as Record<string, unknown>
  } catch {
    return jsonWithCors(
      request,
      { error: 'token_exchange_failed' },
      { status: 502 },
    )
  }

  if (!tokenRes.ok) {
    return jsonWithCors(
      request,
      {
        error: 'token_exchange_failed',
        details: safeOAuthErrorCode(payload, 'upstream_error'),
      },
      { status: 502 },
    )
  }

  const body = tokenSuccessBody(payload, {
    includeRefresh: true,
    sealSecret: secret,
  })
  if (typeof body.accessToken !== 'string' || !body.accessToken) {
    return jsonWithCors(
      request,
      { error: 'token_exchange_failed' },
      { status: 502 },
    )
  }

  return jsonWithCors(request, body)
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
