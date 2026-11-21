import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { readGoogleEnv } from '../../server/googleEnv.js'

/**
 * POST /api/google/refresh — refresh_token → access_token.
 * Allowlisted app origins only. Used after mobile code exchange stored a
 * refresh token.
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
      { error: 'client_secret_missing' },
      { status: 503, headers: { 'cache-control': 'private, no-store' } },
    )
  }

  let body: { refreshToken?: string }
  try {
    body = (await request.json()) as { refreshToken?: string }
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const refreshToken = body.refreshToken?.trim()
  if (!refreshToken) {
    return Response.json({ error: 'refresh_token_required' }, { status: 400 })
  }

  const secret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim()
  const params = new URLSearchParams({
    client_id: env.clientId,
    client_secret: secret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
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
        error: 'token_refresh_failed',
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
    },
    { headers: { 'cache-control': 'private, no-store' } },
  )
}
