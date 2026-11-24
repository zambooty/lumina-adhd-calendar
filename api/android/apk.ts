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

/** Soft cap on concurrent APK proxy streams through this process. */
let activeApkStreams = 0
const MAX_CONCURRENT_APK_STREAMS = 2

/**
 * GET /api/android/apk?tag=&asset= — resolve APK from GitHub Releases.
 * Prefers a 302 to the public GitHub download URL (no host egress).
 * Streams only as a last resort (private assets), with size + concurrency caps.
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
  const forceStream = url.searchParams.get('stream') === '1'

  const result = await fetchGithubReleaseAsset({
    tag,
    asset,
    preferRedirect: !forceStream,
  })
  if (!result.ok) {
    return jsonWithCors(
      request,
      { ok: false, error: result.error, hint: result.hint },
      { status: result.status },
    )
  }

  if (result.mode === 'redirect') {
    const headers = new Headers({ Location: result.url, ...NO_STORE })
    const cors = withCors(request, { headers }).headers
    return new Response(null, {
      status: 302,
      headers: cors ? new Headers(cors) : headers,
    })
  }

  if (activeApkStreams >= MAX_CONCURRENT_APK_STREAMS) {
    return jsonWithCors(
      request,
      {
        ok: false,
        error: 'apk_busy',
        hint: 'Too many APK downloads in flight — retry shortly, or use the public GitHub release URL.',
      },
      { status: 503 },
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

  activeApkStreams += 1
  let released = false
  const releaseSlot = () => {
    if (released) return
    released = true
    activeApkStreams = Math.max(0, activeApkStreams - 1)
  }

  const upstream = result.body
  const body =
    upstream == null
      ? null
      : upstream.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              controller.enqueue(chunk)
            },
            flush() {
              releaseSlot()
            },
          }),
        )

  if (body) {
    request.signal.addEventListener('abort', releaseSlot, { once: true })
  } else {
    releaseSlot()
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
  headers.set('x-lumina-apk-mode', 'stream')

  return new Response(body, { status: 200, headers })
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
