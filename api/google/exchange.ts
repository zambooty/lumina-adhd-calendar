import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { readGoogleEnv } from '../../server/googleEnv.js'
import {
  NO_STORE,
  clientKeyFromRequest,
  exchangeRateLimit,
  isJsonContentType,
  parseExchangeBody,
  rateLimitedResponse,
  safeOAuthErrorCode,
  tokenSuccessBody,
} from '../../server/googleTokenSecurity.js'

/**
 * POST /api/google/exchange — auth-code → token exchange.
 * Allowlisted app origins only. Primary Connect Google flow uses GIS token
 * client (no exchange); mobile redirect OAuth requires this route.
 *
 * Hardening: static origin allowlist, allowlisted redirect_uri only,
 * grant_type fixed to authorization_code, rate limit, no token leakage
 * in error bodies.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'forbidden_origin' }, { status: 403, headers: NO_STORE })
  }

  const limit = exchangeRateLimit(clientKeyFromRequest(request))
  if (!limit.allowed) {
    return rateLimitedResponse(limit)
  }

  if (!isJsonContentType(request)) {
    return Response.json(
      { error: 'invalid_content_type' },
      { status: 415, headers: NO_STORE },
    )
  }

  const env = readGoogleEnv()
  if (!env.configured || !env.clientId) {
    return Response.json(
      { error: 'google_not_configured', demoMode: true },
      { status: 503, headers: NO_STORE },
    )
  }
  if (!env.hasClientSecret) {
    return Response.json(
      {
        error: 'client_secret_missing',
        hint: 'Token-client (GIS) flow does not need this route; bind GOOGLE_CLIENT_SECRET for code exchange.',
      },
      { status: 503, headers: NO_STORE },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: NO_STORE })
  }

  const parsed = parseExchangeBody(raw, {
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    host: request.headers.get('host'),
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
  })
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.error },
      { status: parsed.status, headers: NO_STORE },
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
    return Response.json(
      { error: 'token_exchange_failed' },
      { status: 502, headers: NO_STORE },
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = (await tokenRes.json()) as Record<string, unknown>
  } catch {
    return Response.json(
      { error: 'token_exchange_failed' },
      { status: 502, headers: NO_STORE },
    )
  }

  if (!tokenRes.ok) {
    return Response.json(
      {
        error: 'token_exchange_failed',
        details: safeOAuthErrorCode(payload, 'upstream_error'),
      },
      { status: 502, headers: NO_STORE },
    )
  }

  const body = tokenSuccessBody(payload, { includeRefresh: true })
  if (typeof body.accessToken !== 'string' || !body.accessToken) {
    return Response.json(
      { error: 'token_exchange_failed' },
      { status: 502, headers: NO_STORE },
    )
  }

  return Response.json(body, { headers: NO_STORE })
}
