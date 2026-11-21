/**
 * Smoke checks for googleTokenSecurity helpers (no network).
 * Run: npx tsx scripts/check-google-token-security.mjs
 */
import assert from 'node:assert/strict'
import {
  parseExchangeBody,
  parseRefreshBody,
  safeOAuthErrorCode,
  tokenSuccessBody,
} from '../server/googleTokenSecurity.ts'
import { resetRateLimits, takeRateLimit } from '../server/rateLimit.ts'
import { PUBLISHED_APP_ORIGIN } from '../server/originAllowlist.ts'

const published = PUBLISHED_APP_ORIGIN

// Happy path exchange
{
  const parsed = parseExchangeBody({
    code: '4/abc.def',
    redirectUri: published,
  })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    assert.equal(parsed.code, '4/abc.def')
    assert.equal(parsed.redirectUri, published)
  }
}

// Trailing-slash redirect ok
assert.equal(
  parseExchangeBody({ code: 'x', redirectUri: `${published}/` }).ok,
  true,
)

// Arbitrary redirect rejected
{
  const parsed = parseExchangeBody({
    code: 'x',
    redirectUri: 'https://evil.example',
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) {
    assert.equal(parsed.error, 'redirect_uri_forbidden')
    assert.equal(parsed.status, 403)
  }
}

// Path redirect rejected
{
  const parsed = parseExchangeBody({
    code: 'x',
    redirectUri: `${published}/oauth`,
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.equal(parsed.error, 'redirect_uri_forbidden')
}

// Missing code
{
  const parsed = parseExchangeBody({ redirectUri: published })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.equal(parsed.error, 'code_required')
}

// Bad grant type
{
  const parsed = parseExchangeBody({
    code: 'x',
    redirectUri: published,
    grant_type: 'client_credentials',
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.equal(parsed.error, 'unsupported_grant_type')
}

// authorization_code grant explicitly ok
assert.equal(
  parseExchangeBody({
    code: 'x',
    redirectUri: published,
    grant_type: 'authorization_code',
  }).ok,
  true,
)

// Code with whitespace rejected
{
  const parsed = parseExchangeBody({
    code: 'ab cd',
    redirectUri: published,
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.equal(parsed.error, 'code_invalid')
}

// Refresh happy path
assert.equal(parseRefreshBody({ refreshToken: '1//abc' }).ok, true)

// Refresh bad grant
{
  const parsed = parseRefreshBody({
    refreshToken: '1//abc',
    grant_type: 'authorization_code',
  })
  assert.equal(parsed.ok, false)
  if (!parsed.ok) assert.equal(parsed.error, 'unsupported_grant_type')
}

// Safe OAuth error mapping — never echo descriptions / unknown blobs
assert.equal(
  safeOAuthErrorCode({ error: 'invalid_grant', error_description: 'secret' }),
  'invalid_grant',
)
assert.equal(
  safeOAuthErrorCode({ error: 'totally_custom', error_description: 'leak' }),
  'upstream_error',
)

// Success body strips unknown keys (id_token etc.)
{
  const body = tokenSuccessBody(
    {
      access_token: 'ya29.a',
      expires_in: 3600,
      scope: 's',
      token_type: 'Bearer',
      refresh_token: '1//r',
      id_token: 'should-not-leak',
      weird: true,
    },
    { includeRefresh: true },
  )
  assert.deepEqual(Object.keys(body).sort(), [
    'accessToken',
    'expiresIn',
    'refreshToken',
    'scope',
    'tokenType',
  ])
  assert.equal(body.refreshToken, '1//r')
  assert.equal('id_token' in body, false)
}

// Rate limiter
resetRateLimits()
for (let i = 0; i < 3; i++) {
  assert.equal(takeRateLimit('t', 3, 60_000).allowed, true)
}
assert.equal(takeRateLimit('t', 3, 60_000).allowed, false)

console.log('google token security checks passed')
