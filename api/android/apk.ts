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
import {
  MAX_APK_PROXY_BYTES,
  fetchGithubReleaseAsset,
} from '../../server/androidUpdate.js'

/**
 * GET /api/android/apk?tag=&asset= — stream APK from GitHub Releases.
 * Public assets need no token; optional GITHUB_TOKEN is a rate-limit / private fallback.
 * Hard size cap + tighter rate limit to avoid unbounded egress.
 */
export async function GET(request: Request): Promise<Response> {
  const limit = takeRateLimit(
    `android-apk:${clientKeyFromRequest(request)}`,
    8,
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

  const result = await fetchGithubReleaseAsset({ tag, asset })
  if (!result.ok) {
    return jsonWithCors(
      request,
      { ok: false, error: result.error, hint: result.hint },
      { status: result.status },
    )
  }

  if (result.size != null && result.size > MAX_APK_PROXY_BYTES) {
    return jsonWithCors(
      request,
      {
        ok: false,
        error: 'apk_too_large',
        hint: 'APK exceeds the proxy size limit.',
      },
      { status: 413 },
    )
  }

  const headers = new Headers()
  const cors = withCors(request, { headers: { ...NO_STORE } }).headers
  if (cors) {
    const c = new Headers(cors)
    c.forEach((v, k) => headers.set(k, v))
  }
  headers.set('content-type', result.contentType)
  headers.set(
    'content-disposition',
    `attachment; filename="${result.filename.replace(/"/g, '')}"`,
  )
  if (result.size != null && result.size > 0) {
    headers.set('content-length', String(result.size))
  }
  headers.set('cache-control', 'private, no-store')
  headers.set('x-lumina-apk-max-bytes', String(MAX_APK_PROXY_BYTES))

  return new Response(result.body, { status: 200, headers })
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
