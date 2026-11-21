import { readCaptureEnv, readWhisperApiKey } from '../../server/captureEnv.js'
import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import {
  NO_STORE,
  clientKeyFromRequest,
  consumeCaptureToken,
  rateLimitedResponse,
  readCaptureTokenHeader,
  transcribeMaxBytes,
  transcribeRateLimit,
} from '../../server/captureSecurity.js'

/**
 * POST /api/capture/transcribe — multipart audio → Whisper text.
 *
 * Hardening:
 * - Static origin allowlist only (Host / X-Forwarded never expands it)
 * - Short-lived one-shot captureToken from gated /api/capture/status
 * - Upload size cap + per-IP rate limit
 * - Disabled (503) when Whisper/OpenAI key unbound; never leaks keys
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

  const clientKey = clientKeyFromRequest(request)
  const limit = transcribeRateLimit(clientKey)
  if (!limit.allowed) {
    return rateLimitedResponse(limit)
  }

  const captureToken = readCaptureTokenHeader(request)
  if (!consumeCaptureToken(captureToken, clientKey)) {
    return Response.json(
      {
        error: 'capture_token_required',
        hint: 'Refresh capture status (same-origin) to mint a short-lived token, then retry.',
      },
      { status: 403, headers: NO_STORE },
    )
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
    const payload = (await res.json()) as {
      text?: string
      error?: { message?: string; type?: string }
    }
    if (!res.ok) {
      // Never forward upstream message bodies that might echo request metadata.
      return Response.json(
        { error: 'whisper_failed' },
        { status: 502, headers: NO_STORE },
      )
    }
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
