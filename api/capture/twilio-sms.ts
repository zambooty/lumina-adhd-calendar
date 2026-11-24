import { readCaptureEnv } from '../../server/captureEnv.js'
import {
  NO_STORE,
  clientKeyFromRequest,
  rateLimitedResponse,
  readRequestTextCapped,
  readTwilioAuthToken,
  twilioSmsBodyMaxChars,
  twilioSmsMaxBytes,
  twilioSmsRateLimit,
  twilioWebhookUrl,
  verifyTwilioSignature,
} from '../../server/captureSecurity.js'

/**
 * POST /api/capture/twilio-sms — Twilio inbound SMS webhook stub.
 *
 * When Twilio secrets are unbound, returns 503 with an honest message.
 * When bound, requires a valid `X-Twilio-Signature` (rejects unsigned).
 * Body size + per-client rate limits apply before signature verify.
 *
 * Twilio form fields: Body, From, To, MessageSid
 */
export async function POST(request: Request): Promise<Response> {
  const env = readCaptureEnv()
  if (!env.twilioConfigured) {
    return Response.json(
      {
        error: 'twilio_not_configured',
        hint: 'Bind TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN, or paste SMS in the app.',
      },
      { status: 503, headers: NO_STORE },
    )
  }

  const authToken = readTwilioAuthToken()
  if (!authToken) {
    return Response.json(
      { error: 'twilio_not_configured' },
      { status: 503, headers: NO_STORE },
    )
  }

  const limit = twilioSmsRateLimit(clientKeyFromRequest(request))
  if (!limit.allowed) {
    return rateLimitedResponse(limit)
  }

  const capped = await readRequestTextCapped(request, twilioSmsMaxBytes())
  if (!capped.ok) {
    return Response.json(
      { error: 'payload_too_large' },
      { status: 413, headers: NO_STORE },
    )
  }

  let params: Record<string, string> = {}
  try {
    const ct = request.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      const json = JSON.parse(capped.text || '{}') as Record<string, unknown>
      for (const [key, value] of Object.entries(json)) {
        if (value == null) continue
        params[key] = String(value)
      }
    } else {
      const search = new URLSearchParams(capped.text)
      for (const [key, value] of search.entries()) {
        params[key] = value
      }
    }
  } catch {
    return Response.json(
      { error: 'invalid_body' },
      { status: 400, headers: NO_STORE },
    )
  }

  const signature = request.headers.get('x-twilio-signature')
  const url = twilioWebhookUrl(request)
  if (
    !verifyTwilioSignature({
      authToken,
      signature,
      url,
      params,
    })
  ) {
    return Response.json(
      { error: 'invalid_twilio_signature' },
      { status: 403, headers: NO_STORE },
    )
  }

  const body = (params.Body ?? '').trim()
  const from = params.From ?? ''
  if (!body) {
    return Response.json(
      { error: 'empty_body' },
      { status: 400, headers: NO_STORE },
    )
  }
  if (body.length > twilioSmsBodyMaxChars()) {
    return Response.json(
      { error: 'body_too_large' },
      { status: 413, headers: NO_STORE },
    )
  }

  // Acknowledge receipt. Browser-side ingest still uses paste until a shared
  // queue (KV / DB) lands; response is empty TwiML (no echo of message body).
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/xml',
        ...NO_STORE,
        // Truncated metadata only — never echo message body.
        'x-lumina-sms-from': from.slice(0, 32),
        'x-lumina-sms-received': '1',
      },
    },
  )
}
