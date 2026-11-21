/**
 * Smoke checks for captureSecurity + googleAccessAuth helpers (no network).
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
import { readGoogleAccessToken } from '../server/googleAccessAuth.ts'
import { isAllowedAppOrigin, PUBLISHED_APP_ORIGIN } from '../server/originAllowlist.ts'
import { resetRateLimits } from '../server/rateLimit.ts'

resetCaptureTokens()
resetRateLimits()

// Google Bearer extraction
{
  const req = new Request('https://example.test/api/capture/transcribe', {
    headers: { authorization: 'Bearer ya29.a0AfH6SMB-test-token-value' },
  })
  assert.equal(
    readGoogleAccessToken(req),
    'ya29.a0AfH6SMB-test-token-value',
  )
}
{
  const req = new Request('https://example.test/api/capture/transcribe', {
    headers: {
      'x-lumina-google-access-token': 'ya29.header-fallback-token',
    },
  })
  assert.equal(readGoogleAccessToken(req), 'ya29.header-fallback-token')
}
{
  const req = new Request('https://example.test/api/capture/transcribe')
  assert.equal(readGoogleAccessToken(req), null)
}
{
  const req = new Request('https://example.test/api/capture/transcribe', {
    headers: { authorization: 'Basic nope' },
  })
  assert.equal(readGoogleAccessToken(req), null)
}

// Legacy capture-token helpers still work (unused by transcribe auth path)
{
  const token = mintCaptureToken('1.2.3.4')
  assert.equal(consumeCaptureToken(token, '1.2.3.4'), true)
  assert.equal(consumeCaptureToken(token, '1.2.3.4'), false)
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
      signature: null,
      url,
      params,
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

// Origin allowlist still static (Host does not expand)
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
