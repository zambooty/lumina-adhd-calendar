/**
 * Smoke checks for captureSecurity helpers (no network).
 * Run: npx tsx scripts/check-capture-security.mjs
 */
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  consumeCaptureToken,
  mintCaptureToken,
  resetCaptureTokens,
  verifyTwilioSignature,
  twilioWebhookUrl,
  DEFAULT_TRANSCRIBE_MAX_BYTES,
} from '../server/captureSecurity.ts'
import { isAllowedAppOrigin, PUBLISHED_APP_ORIGIN } from '../server/originAllowlist.ts'
import { resetRateLimits } from '../server/rateLimit.ts'

resetCaptureTokens()
resetRateLimits()

// Nonce mint + one-shot consume
{
  const token = mintCaptureToken('1.2.3.4')
  assert.equal(typeof token, 'string')
  assert.ok(token.length >= 16)
  assert.equal(consumeCaptureToken(token, '1.2.3.4'), true)
  // Second spend fails
  assert.equal(consumeCaptureToken(token, '1.2.3.4'), false)
}

// Wrong / missing token
assert.equal(consumeCaptureToken(null, '1.2.3.4'), false)
assert.equal(consumeCaptureToken('short', '1.2.3.4'), false)
assert.equal(consumeCaptureToken('totally-unknown-token-value-xx', '1.2.3.4'), false)

// Soft client binding: unknown ↔ known ok either way; mismatched knowns fail
{
  const a = mintCaptureToken('10.0.0.1')
  assert.equal(consumeCaptureToken(a, 'unknown'), true)
  const b = mintCaptureToken('unknown')
  assert.equal(consumeCaptureToken(b, '10.0.0.2'), true)
  const c = mintCaptureToken('10.0.0.1')
  assert.equal(consumeCaptureToken(c, '10.0.0.2'), false)
}

// Twilio signature — known vector
{
  const authToken = 'test_auth_token_12345'
  const url = 'https://lumina-calendar-f5eb.apps.grok.bot/api/capture/twilio-sms'
  const params = {
    Body: 'gym Thursday 7am',
    From: '+15551234567',
    To: '+15557654321',
    MessageSid: 'SMxxxxxxxx',
  }
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('')
  const signature = createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf8'))
    .digest('base64')

  assert.equal(
    verifyTwilioSignature({ authToken, signature, url, params }),
    true,
  )
  assert.equal(
    verifyTwilioSignature({
      authToken,
      signature: 'bogus',
      url,
      params,
    }),
    false,
  )
  assert.equal(
    verifyTwilioSignature({
      authToken,
      signature: null,
      url,
      params,
    }),
    false,
  )
  // Tampered body
  assert.equal(
    verifyTwilioSignature({
      authToken,
      signature,
      url,
      params: { ...params, Body: 'evil' },
    }),
    false,
  )
}

// Webhook URL prefers PUBLIC_APP_ORIGIN
{
  const prev = process.env.PUBLIC_APP_ORIGIN
  process.env.PUBLIC_APP_ORIGIN = 'https://example.test'
  const req = new Request('http://internal:8080/api/capture/twilio-sms', {
    method: 'POST',
  })
  assert.equal(
    twilioWebhookUrl(req),
    'https://example.test/api/capture/twilio-sms',
  )
  if (prev === undefined) delete process.env.PUBLIC_APP_ORIGIN
  else process.env.PUBLIC_APP_ORIGIN = prev
}

// Origin allowlist still static (Host does not expand) — sanity for capture gate
assert.equal(
  isAllowedAppOrigin({
    origin: 'https://evil.example',
    host: 'lumina-calendar-f5eb.apps.grok.bot',
    'x-forwarded-host': 'lumina-calendar-f5eb.apps.grok.bot',
  }),
  false,
)
assert.equal(
  isAllowedAppOrigin({ origin: PUBLISHED_APP_ORIGIN }),
  true,
)

assert.ok(DEFAULT_TRANSCRIBE_MAX_BYTES >= 1_000_000)

console.log('capture security checks passed')
