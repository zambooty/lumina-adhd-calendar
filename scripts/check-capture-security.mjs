/**
 * Smoke checks for captureSecurity + googleAccessAuth helpers (no network).
 * Run: npx tsx scripts/check-capture-security.mjs
 */
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  consumeCaptureToken,
  isTranscribeCallerAllowed,
  mintCaptureToken,
  readRequestTextCapped,
  readTranscribeAllowlist,
  resetCaptureTokens,
  twilioSmsMaxBytes,
  twilioSmsRateLimit,
  verifyTwilioSignature,
  twilioWebhookUrl,
  whisperSpendEnabled,
  DEFAULT_TRANSCRIBE_MAX_BYTES,
  DEFAULT_TWILIO_SMS_MAX_BYTES,
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
assert.ok(DEFAULT_TWILIO_SMS_MAX_BYTES >= 1024)
assert.equal(twilioSmsMaxBytes(), DEFAULT_TWILIO_SMS_MAX_BYTES)

// Twilio SMS body cap + rate limit
{
  const tooBigHeader = new Request('https://example.test/api/capture/twilio-sms', {
    method: 'POST',
    headers: { 'content-length': String(DEFAULT_TWILIO_SMS_MAX_BYTES + 1) },
    body: 'x'.repeat(32),
  })
  const rejected = await readRequestTextCapped(
    tooBigHeader,
    DEFAULT_TWILIO_SMS_MAX_BYTES,
  )
  assert.equal(rejected.ok, false)

  const okBody = new Request('https://example.test/api/capture/twilio-sms', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'Body=hi&From=%2B15551234567',
  })
  const accepted = await readRequestTextCapped(okBody, DEFAULT_TWILIO_SMS_MAX_BYTES)
  assert.equal(accepted.ok, true)
  if (accepted.ok) assert.match(accepted.text, /Body=hi/)

  const streamOver = new Request('https://example.test/api/capture/twilio-sms', {
    method: 'POST',
    body: 'y'.repeat(DEFAULT_TWILIO_SMS_MAX_BYTES + 64),
  })
  const streamed = await readRequestTextCapped(
    streamOver,
    DEFAULT_TWILIO_SMS_MAX_BYTES,
  )
  assert.equal(streamed.ok, false)

  resetRateLimits()
  let denied = false
  for (let i = 0; i < 40; i++) {
    const result = twilioSmsRateLimit('test-twilio-ip')
    if (!result.allowed) {
      denied = true
      break
    }
  }
  assert.equal(denied, true, 'twilioSmsRateLimit should trip within 40 hits')
}

// Whisper spend fail-closed without allowlist
{
  const prevEmails = process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS
  const prevSubs = process.env.CAPTURE_TRANSCRIBE_ALLOWED_SUBS
  delete process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS
  delete process.env.CAPTURE_TRANSCRIBE_ALLOWED_SUBS
  assert.equal(readTranscribeAllowlist().configured, false)
  assert.equal(whisperSpendEnabled(true), false)
  assert.equal(isTranscribeCallerAllowed('sub1', 'a@b.com'), false)

  process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS = 'Owner@Example.com'
  assert.equal(readTranscribeAllowlist().configured, true)
  assert.equal(whisperSpendEnabled(true), true)
  assert.equal(isTranscribeCallerAllowed(null, 'owner@example.com'), true)
  assert.equal(isTranscribeCallerAllowed(null, 'other@example.com'), false)

  delete process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS
  process.env.CAPTURE_TRANSCRIBE_ALLOWED_SUBS = 'google-sub-123'
  assert.equal(isTranscribeCallerAllowed('google-sub-123', null), true)
  assert.equal(isTranscribeCallerAllowed('other-sub', null), false)

  if (prevEmails === undefined) delete process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS
  else process.env.CAPTURE_TRANSCRIBE_ALLOWED_EMAILS = prevEmails
  if (prevSubs === undefined) delete process.env.CAPTURE_TRANSCRIBE_ALLOWED_SUBS
  else process.env.CAPTURE_TRANSCRIBE_ALLOWED_SUBS = prevSubs
}

console.log('capture security checks passed')
