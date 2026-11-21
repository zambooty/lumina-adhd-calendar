import { readCaptureEnv, readWhisperApiKey } from '../../server/captureEnv.js'
import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { requireGoogleAccessAuth } from '../../server/googleAccessAuth.js'
import {
  NO_STORE,
  clientKeyFromRequest,
  rateLimitedResponse,
  transcribeMaxBytes,
  transcribeRateLimit,
} from '../../server/captureSecurity.js'

/**
 * POST /api/capture/transcribe — multipart audio → Whisper text.
 *
 * Auth: caller must present a live Google OAuth access token issued for
 * this app's GOOGLE_CLIENT_ID (verified via Google tokeninfo). Origin
 * allowlist + rate/size limits are defense-in-depth only — they are not
 * the sole gate. Disabled when Whisper/OpenAI key unbound; never leaks keys.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json(
      { error: 'forbidden_origin' },
      { status: 403, headers: NO_STORE },
    )
  }

  const env = readCaptureEnv()
  const apiKey = readWhisperApiKey()
  if (!env.whisperConfigured || !apiKey) {
    return Response.json(
      {
        error: 'whisper_not_configured',
        hint: 'Bind WHISPER_API_KEY or OPENAI_API_KEY, or paste a transcript instead.',
      },
      { status: 503, headers: NO_STORE },
    )
  }

  // Real caller check — spoofed Origin alone cannot pass this.
  const auth = await requireGoogleAccessAuth(request)
  if (!auth.ok) return auth.response

  const clientKey = clientKeyFromRequest(request)
  const limit = transcribeRateLimit(clientKey)
  if (!limit.allowed) {
    return rateLimitedResponse(limit)
  }

  const maxBytes = transcribeMaxBytes()
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const n = Number.parseInt(contentLength, 10)
    if (Number.isFinite(n) && n > maxBytes) {
      return Response.json(
        { error: 'payload_too_large' },
        { status: 413, headers: NO_STORE },
      )
    }
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json(
      { error: 'invalid_multipart' },
      { status: 400, headers: NO_STORE },
    )
  }

  const file = form.get('file')
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json(
      { error: 'missing_file' },
      { status: 400, headers: NO_STORE },
    )
  }
  if (file.size > maxBytes) {
    return Response.json(
      { error: 'payload_too_large' },
      { status: 413, headers: NO_STORE },
    )
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
      return Response.json(
        { error: 'whisper_failed' },
        { status: 502, headers: NO_STORE },
      )
    }
    const payload = (await res.json()) as { text?: string }
    return Response.json(
      { transcript: typeof payload.text === 'string' ? payload.text : '' },
      { headers: NO_STORE },
    )
  } catch {
    return Response.json(
      { error: 'whisper_failed' },
      { status: 502, headers: NO_STORE },
    )
  }
}
