import { readCaptureEnv, readWhisperApiKey } from '../../server/captureEnv.js'
import { isAllowedRequestOrigin } from '../../server/originAllowlist.js'

/**
 * POST /api/capture/transcribe — multipart audio → Whisper text.
 * Requires WHISPER_API_KEY or OPENAI_API_KEY. No secret values in responses.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAllowedRequestOrigin(request)) {
    return Response.json({ error: 'forbidden_origin' }, { status: 403 })
  }

  const env = readCaptureEnv()
  const apiKey = readWhisperApiKey()
  if (!env.whisperConfigured || !apiKey) {
    return Response.json(
      {
        error:
          'whisper_not_configured',
        hint: 'Bind WHISPER_API_KEY or OPENAI_API_KEY, or paste a transcript instead.',
      },
      { status: 503 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'invalid_multipart' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: 'missing_file' }, { status: 400 })
  }

  const filename =
    (typeof form.get('filename') === 'string' && form.get('filename')) ||
    'voicemail.webm'

  const upstream = new FormData()
  upstream.append('file', file, String(filename))
  upstream.append('model', 'whisper-1')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
      body: upstream,
    })
    const payload = (await res.json()) as { text?: string; error?: { message?: string } }
    if (!res.ok) {
      return Response.json(
        {
          error: 'whisper_failed',
          details: payload.error?.message ?? res.statusText,
        },
        { status: 502 },
      )
    }
    return Response.json(
      { transcript: payload.text ?? '' },
      { headers: { 'cache-control': 'private, no-store' } },
    )
  } catch (err) {
    return Response.json(
      {
        error: 'whisper_failed',
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 502 },
    )
  }
}
