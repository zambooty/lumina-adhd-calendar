import { readCaptureEnv } from '../../server/captureEnv.js'

/**
 * POST /api/capture/twilio-sms — Twilio inbound SMS webhook stub.
 *
 * When Twilio secrets are unbound, returns 503 with an honest message.
 * When bound, acknowledges the webhook. Full queue bridging to the browser
 * needs a shared store (future); for MVP the UI still supports paste-import.
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
      { status: 503 },
    )
  }

  let body = ''
  let from = ''
  try {
    const ct = request.headers.get('content-type') ?? ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      body = params.get('Body') ?? ''
      from = params.get('From') ?? ''
    } else if (ct.includes('application/json')) {
      const json = (await request.json()) as { Body?: string; From?: string }
      body = json.Body ?? ''
      from = json.From ?? ''
    } else {
      const text = await request.text()
      const params = new URLSearchParams(text)
      body = params.get('Body') ?? text
      from = params.get('From') ?? ''
    }
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!body.trim()) {
    return Response.json({ error: 'empty_body' }, { status: 400 })
  }

  // Acknowledge receipt. Browser-side ingest still uses paste until a shared
  // queue (KV / DB) lands; response echoes a parse hint for operators.
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/xml',
        'cache-control': 'private, no-store',
        'x-lumina-sms-from': from.slice(0, 32),
        'x-lumina-sms-received': '1',
      },
    },
  )
}
