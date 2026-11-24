import {
  clientKeyFromRequest,
  rateLimitedResponse,
  NO_STORE,
} from '../../server/googleTokenSecurity.js'
import { takeRateLimit } from '../../server/rateLimit.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'
import { fetchGithubReleaseAsset } from '../../server/androidUpdate.js'

/**
 * GET /api/android/apk?tag=&asset= — 302 to the public GitHub APK URL.
 * No GitHub API tag lookup (avoids unauthenticated fan-out). Stream mode and
 * `?stream=1` leftovers removed — Cap downloads from GitHub directly.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = takeRateLimit(
    `android-apk:${clientKeyFromRequest(request)}`,
    4,
    60_000,
  )
  if (!limit.allowed) {
    const limited = rateLimitedResponse(limit)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
  }

  const url = new URL(request.url)
  const tag = url.searchParams.get('tag') || ''
  const asset = url.searchParams.get('asset') || 'lumina-debug.apk'

  const result = await fetchGithubReleaseAsset({
    tag,
    asset,
    preferRedirect: true,
  })
  if (!result.ok) {
    return jsonWithCors(
      request,
      { ok: false, error: result.error, hint: result.hint },
      { status: result.status },
    )
  }

  if (result.mode !== 'redirect') {
    // Stream path retained in androidUpdate for private/token fallback only;
    // this public route never streams.
    return jsonWithCors(
      request,
      {
        ok: false,
        error: 'stream_disabled',
        hint: 'Use the public GitHub release download URL.',
      },
      { status: 400 },
    )
  }

  const headers = new Headers({ Location: result.url, ...NO_STORE })
  const cors = withCors(request, { headers }).headers
  return new Response(null, {
    status: 302,
    headers: cors ? new Headers(cors) : headers,
  })
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
