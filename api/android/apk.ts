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
 * GET /api/android/apk?tag=&asset= — stream APK from GitHub Releases.
 * Private repos need GITHUB_TOKEN (Contents: Read).
 */
export async function GET(request: Request): Promise<Response> {
  const limit = takeRateLimit(
    `android-apk:${clientKeyFromRequest(request)}`,
    20,
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

  return new Response(result.body, { status: 200, headers })
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
