import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { readGoogleEnv } from '../../server/googleEnv.js'

/**
 * POST /api/google/exchange — optional auth-code → token exchange.
 * Allowlisted app origins only. Primary Connect Google flow uses GIS token
 * client (no exchange); mobile redirect OAuth requires this route.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json(
      { error: 'forbidden_origin' },
      { status: 403, headers: { 'cache-control': 'private, no-store' } },
    )
  }

  const env = readGoogleEnv()
  if (!env.configured || !env.clientId) {
    return Response.json(
      { error: 'google_not_configured', demoMode: true },
      { status: 503, headers: { 'cache-control': 'private, no-store' } },
    )
  }
  if (!env.hasClientSecret) {
    return Response.json(
      {
        error: 'client_secret_missing',
        hint: 'Token-client (GIS) flow does not need this route; bind GOOGLE_CLIENT_SECRET for code exchange.',
      },
      { status: 503, headers: { 'cache-control': 'private, no-store' } },
    )
  }

  let body: { code?: string; redirectUri?: string }
  try {
    body = (await request.json()) as { code?: string; redirectUri?: string }
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const code = body.code?.trim()
  if (!code) {
    return Response.json({ error: 'code_required' }, { status: 400 })
  }

  // Must match the redirect_uri used in the auth request exactly.
  // App sends window.location.origin (no trailing slash). Accept that form;
  // never default to postmessage for redirect-based mobile exchange.
  const redirectUri = body.redirectUri?.trim()
  if (!redirectUri) {
    return Response.json({ error: 'redirect_uri_required' }, { status: 400 })
  }

  const secret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  const params = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: secret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const payload = (await tokenRes.json()) as Record<string, unknown>
  if (!tokenRes.ok) {
    return Response.json(
      {
        error: 'token_exchange_failed',
        details: payload.error ?? tokenRes.statusText,
      },
      { status: 502, headers: { 'cache-control': 'private, no-store' } },
    )
  }

  return Response.json(
    {
      accessToken: payload.access_token,
      expiresIn: payload.expires_in,
      scope: payload.scope,
      tokenType: payload.token_type,
      refreshToken: payload.refresh_token ?? null,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
