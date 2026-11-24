import { readCaptureEnv, readWhisperApiKey } from '../../server/captureEnv.js'
import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'
import { requireGoogleAccessAuth } from '../../server/googleAccessAuth.js'
import {
  clientKeyFromRequest,
  isTranscribeCallerAllowed,
  rateLimitedResponse,
  transcribeCallerRateLimit,
  transcribeGlobalRateLimit,
  transcribeMaxBytes,
  transcribePreAuthRateLimit,
  whisperSpendEnabled,
} from '../../server/captureSecurity.js'
import {
  corsPreflightResponse,
  jsonWithCors,
  withCors,
} from '../../server/cors.js'

/**
 * POST /api/capture/transcribe — multipart audio → Whisper text.
 *
 * Spend gate (fail-closed for a public app):
 *   1. Origin allowlist
 *   2. Pre-auth IP rate limit (before Google tokeninfo)
 *   3. Whisper/OpenAI key bound
 *   4. CAPTURE_TRANSCRIBE_ALLOWED_EMAILS and/or _SUBS configured
 *   5. Caller Google access token verified for this GOOGLE_CLIENT_ID
 *   6. Caller's email/sub is on the allowlist (any Google user is not enough)
 *   7. Per-subject + global rate limits
 *
 * When the allowlist is empty, returns 503 — paste a transcript instead.
 * Never leaks keys.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return jsonWithCors(request, { error: 'forbidden_origin' }, { status: 403 })
  }

  const preAuth = transcribePreAuthRateLimit(clientKeyFromRequest(request))
  if (!preAuth.allowed) {
    const limited = rateLimitedResponse(preAuth)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
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

  if (!whisperSpendEnabled(env.whisperConfigured)) {
    return jsonWithCors(
      request,
      {
        error: 'whisper_allowlist_required',
        hint:
          'Bind CAPTURE_TRANSCRIBE_ALLOWED_EMAILS (or _SUBS) to your Google account before speech-to-text can spend the Whisper key. Paste a transcript until then.',
      },
      { status: 503 },
    )
  }

  const auth = await requireGoogleAccessAuth(request)
  if (!auth.ok) return auth.response

  if (!isTranscribeCallerAllowed(auth.sub, auth.email)) {
    return jsonWithCors(
      request,
      {
        error: 'whisper_not_allowed',
        hint:
          'This Google account is not on the speech-to-text allowlist. Paste a transcript, or add your email to CAPTURE_TRANSCRIBE_ALLOWED_EMAILS.',
      },
      { status: 403 },
    )
  }

  const callerKey = auth.sub ?? auth.email ?? 'unknown'
  const callerLimit = transcribeCallerRateLimit(callerKey)
  if (!callerLimit.allowed) {
    const limited = rateLimitedResponse(callerLimit)
    return new Response(
      limited.body,
      withCors(request, { status: limited.status, headers: limited.headers }),
    )
  }

  const globalLimit = transcribeGlobalRateLimit()
  if (!globalLimit.allowed) {
    const limited = rateLimitedResponse(globalLimit)
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
