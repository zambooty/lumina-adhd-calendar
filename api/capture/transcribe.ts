import { readCaptureEnv, readWhisperApiKey } from '../../server/captureEnv.js'
import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { requireGoogleAccessAuth } from '../../server/googleAccessAuth.js'
import {
  clientKeyFromRequest,
  rateLimitedResponse,
  transcribeMaxBytes,
  transcribeRateLimit,
} from '../../server/captureSecurity.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

/**
 * POST /api/capture/transcribe — multipart audio → Whisper text.
 *
 * Auth: caller must present a live Google OAuth access token issued for
 * this app's GOOGLE_CLIENT_ID (verified via Google tokeninfo). Origin
 * allowlist + rate/size limits are defense-in-depth only — they are not
 * the sole gate. Disabled when Whisper/OpenAI key unbound; never leaks keys.
 * CORS for Capacitor → published API.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return jsonWithCors(request, { error: 'forbidden_origin' }, { status: 403 })
  }

  const env = readCaptureEnv()
  const apiKey = readWhisperApiKey()
  if (!env.whisperConfigured || !apiKey) {
    return jsonWithCors(
      request,
      {
        error: 'whisper_not_configured',
        hint: 'Bind WHISPER_API_KEY or OPENAI_API_KEY, or paste a transcript instead.',
      },
      { status: 503 },
    )
  }

  // Real caller check — spoofed Origin alone cannot pass this.
  const auth = await requireGoogleAccessAuth(request)
  if (!auth.ok) return auth.response

  const clientKey = clientKeyFromRequest(request)
  const limit = transcribeRateLimit(clientKey)
  if (!limit.allowed) {
    const limited = rateLimitedResponse(limit)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
  }

  const maxBytes = transcribeMaxBytes()
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const n = Number.parseInt(contentLength, 10)
    if (Number.isFinite(n) && n > maxBytes) {
      return jsonWithCors(request, { error: 'payload_too_large' }, { status: 413 })
    }
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonWithCors(request, { error: 'invalid_multipart' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof Blob) || file.size === 0) {
    return jsonWithCors(request, { error: 'missing_file' }, { status: 400 })
  }
  if (file.size > maxBytes) {
    return jsonWithCors(request, { error: 'payload_too_large' }, { status: 413 })
  }

  const filenameRaw = form.get('filename')
  const filename =
    (typeof filenameRaw === 'string' && filenameRaw.trim()) || 'voicemail.webm'
  // Keep filename boring — never echo path-like names into upstream.
  const safeName = filename.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'voicemail.webm'

  const upstream = new FormData()
  upstream.append('file', file, safeName)
  upstream.append('model', 'whisper-1')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      body: upstream,
    })
    if (!res.ok) {
      // Never forward upstream message bodies that might echo request metadata.
      return jsonWithCors(request, { error: 'whisper_failed' }, { status: 502 })
    }
    const payload = (await res.json()) as { text?: string }
    return jsonWithCors(request, {
      transcript: typeof payload.text === 'string' ? payload.text : '',
    })
  } catch {
    return jsonWithCors(request, { error: 'whisper_failed' }, { status: 502 })
  }
}

export function OPTIONS(request: Request): Response {
  return corsPreflightResponse(request)
}
