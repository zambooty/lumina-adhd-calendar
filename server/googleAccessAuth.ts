/**
 * Verify a caller-held Google OAuth access token for paid capture routes.
 * Tokens are checked with Google (tokeninfo); aud/azp must match our
 * GOOGLE_CLIENT_ID so a random Google token from another app cannot spend
 * Whisper/OpenAI quota.
 */

import { readGoogleEnv } from './googleEnv.js'
import { NO_STORE } from './googleTokenSecurity.js'
import { jsonWithCors } from './cors.js'

export { NO_STORE }

const MAX_ACCESS_TOKEN_LEN = 8192

export type GoogleAccessAuthResult =
  | { ok: true; sub: string | null; expiresIn: number | null }
  | { ok: false; error: string; status: number }

/** Extract Bearer token from Authorization, or X-Lumina-Google-Access-Token. */
export function readGoogleAccessToken(request: Request): string | null {
  const auth = request.headers.get('authorization')?.trim()
  if (auth) {
    const match = /^Bearer\s+(\S+)$/i.exec(auth)
    if (match?.[1]) {
      const token = match[1].trim()
      if (token.length > 0 && token.length <= MAX_ACCESS_TOKEN_LEN) return token
    }
  }
  const header = request.headers.get('x-lumina-google-access-token')?.trim()
  if (header && header.length > 0 && header.length <= MAX_ACCESS_TOKEN_LEN) {
    return header
  }
  return null
}

type TokenInfo = {
  aud?: string
  azp?: string
  sub?: string
  expires_in?: string | number
  error?: string
  error_description?: string
}

function audienceMatches(
  info: TokenInfo,
  clientId: string,
): boolean {
  const aud = typeof info.aud === 'string' ? info.aud.trim() : ''
  const azp = typeof info.azp === 'string' ? info.azp.trim() : ''
  return aud === clientId || azp === clientId
}

/**
 * Ask Google whether `accessToken` is a live token for *our* OAuth client.
 * Network failure → 503 (fail closed for paid routes).
 */
export async function verifyGoogleAccessToken(
  accessToken: string,
): Promise<GoogleAccessAuthResult> {
  const env = readGoogleEnv()
  if (!env.configured || !env.clientId) {
    return { ok: false, error: 'google_not_configured', status: 503 }
  }

  if (!accessToken || accessToken.length < 20) {
    return { ok: false, error: 'google_auth_required', status: 401 }
  }

  let res: Response
  try {
    // tokeninfo validates the token server-side; aud/azp bind it to our client.
    const url = new URL('https://oauth2.googleapis.com/tokeninfo')
    url.searchParams.set('access_token', accessToken)
    res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  } catch {
    return { ok: false, error: 'google_auth_unavailable', status: 503 }
  }

  let info: TokenInfo
  try {
    info = (await res.json()) as TokenInfo
  } catch {
    return { ok: false, error: 'google_auth_invalid', status: 401 }
  }

  if (!res.ok) {
    return { ok: false, error: 'google_auth_invalid', status: 401 }
  }

  if (!audienceMatches(info, env.clientId)) {
    return { ok: false, error: 'google_auth_audience', status: 401 }
  }

  const expiresRaw = info.expires_in
  const expiresIn =
    typeof expiresRaw === 'number'
      ? expiresRaw
      : typeof expiresRaw === 'string'
        ? Number.parseInt(expiresRaw, 10)
        : null

  if (expiresIn != null && Number.isFinite(expiresIn) && expiresIn <= 0) {
    return { ok: false, error: 'google_auth_expired', status: 401 }
  }

  return {
    ok: true,
    sub: typeof info.sub === 'string' ? info.sub.slice(0, 128) : null,
    expiresIn: expiresIn != null && Number.isFinite(expiresIn) ? expiresIn : null,
  }
}

/** Convenience: read + verify; returns a Response on failure. */
export async function requireGoogleAccessAuth(
  request: Request,
): Promise<{ ok: true; sub: string | null } | { ok: false; response: Response }> {
  const token = readGoogleAccessToken(request)
  if (!token) {
    return {
      ok: false,
      response: jsonWithCors(
        request,
        {
          error: 'google_auth_required',
          hint: 'Connect Google in LUMINA, then retry speech-to-text.',
        },
        { status: 401 },
      ),
    }
  }

  const result = await verifyGoogleAccessToken(token)
  if (!result.ok) {
    const hint =
      result.error === 'google_not_configured'
        ? 'Bind GOOGLE_CLIENT_ID so speech-to-text can verify callers.'
        : result.error === 'google_auth_audience'
          ? 'Access token was not issued for this app — Connect Google again.'
          : 'Connect Google (or reconnect) and retry.'
    return {
      ok: false,
      response: jsonWithCors(
        request,
        { error: result.error, hint },
        { status: result.status },
      ),
    }
  }

  return { ok: true, sub: result.sub }
}
