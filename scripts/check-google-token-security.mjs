/**
 * Smoke checks for googleTokenSecurity helpers (no network).
 * Run: npx tsx scripts/check-google-token-security.mjs
 */
import assert from 'node:assert/strict'
import {
  clientKeyFromRequest,
  parseExchangeBody,
  parseRefreshBody,
  safeOAuthErrorCode,
  sealRefreshToken,
  tokenSuccessBody,
  unsealRefreshToken,
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

// Success body strips unknown keys (id_token etc.) and AES-seals refresh
{
  const secret = 'test-client-secret'
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
    { includeRefresh: true, sealSecret: secret },
  )
  assert.deepEqual(Object.keys(body).sort(), [
    'accessToken',
    'expiresIn',
    'refreshToken',
    'scope',
    'tokenType',
  ])
  const sealed = String(body.refreshToken)
  assert.ok(sealed.startsWith('lumina_rt2.'))
  assert.notEqual(sealed, '1//r')
  // Raw token must not be recoverable via base64 of the blob payload.
  assert.equal(sealed.includes('1//r'), false)
  assert.equal(unsealRefreshToken(sealed, secret), '1//r')
  assert.equal(unsealRefreshToken('1//r', secret), null)
  assert.equal('id_token' in body, false)
}

// Seal round-trip + tamper reject
{
  const secret = 'test-client-secret'
  const sealed = sealRefreshToken('1//refresh.abc', secret)
  assert.ok(sealed.startsWith('lumina_rt2.'))
  assert.equal(unsealRefreshToken(sealed, secret), '1//refresh.abc')
  assert.equal(unsealRefreshToken(sealed.slice(0, -2) + 'aa', secret), null)
  assert.equal(unsealRefreshToken(sealed, 'other-secret'), null)
}

// Rate-limit key: last XFF hop; Origin ignored; platform IP only when opted in
{
  const prevTrust = process.env.TRUST_PLATFORM_IP_HEADERS
  delete process.env.TRUST_PLATFORM_IP_HEADERS

  const spoofedFirst = new Request('https://example.com/api', {
    headers: {
      'x-forwarded-for': '1.2.3.4, 10.0.0.9',
      origin: 'https://evil.example',
    },
  })
  const sameEdgeDifferentOrigin = new Request('https://example.com/api', {
    headers: {
      'x-forwarded-for': '9.9.9.9, 10.0.0.9',
      origin: published,
    },
  })
  const alone = new Request('https://example.com/api', {
    headers: {
      'x-forwarded-for': '1.2.3.4',
      origin: published,
    },
  })
  const spoofedRealIp = new Request('https://example.com/api', {
    headers: {
      'x-real-ip': '10.0.0.9',
      'x-forwarded-for': '1.2.3.4',
      origin: 'https://evil.example',
    },
  })
  const a = clientKeyFromRequest(spoofedFirst)
  const b = clientKeyFromRequest(sameEdgeDifferentOrigin)
  const c = clientKeyFromRequest(alone)
  const d = clientKeyFromRequest(spoofedRealIp)
  assert.equal(a, b, 'last XFF hop + Origin must not split the bucket')
  assert.notEqual(a, c, 'different last XFF hop → different key')
  assert.equal(
    c,
    d,
    'without TRUST_PLATFORM_IP_HEADERS, spoofed x-real-ip must be ignored',
  )
  assert.equal(a.length, 32)

  process.env.TRUST_PLATFORM_IP_HEADERS = 'x-real-ip'
  const trusted = clientKeyFromRequest(spoofedRealIp)
  assert.equal(
    trusted,
    a,
    'opted-in x-real-ip should match last-hop key for that IP',
  )
  assert.notEqual(
    trusted,
    c,
    'opted-in x-real-ip must not follow the spoofable XFF-only key',
  )
  assert.equal(
    trusted,
    clientKeyFromRequest(
      new Request('https://example.com/api', {
        headers: {
          'x-real-ip': '10.0.0.9',
          'x-forwarded-for': '9.9.9.9, 8.8.8.8',
        },
      }),
    ),
    'opted-in x-real-ip buckets by platform IP',
  )

  if (prevTrust === undefined) delete process.env.TRUST_PLATFORM_IP_HEADERS
  else process.env.TRUST_PLATFORM_IP_HEADERS = prevTrust
}

// Rate limiter
resetRateLimits()
for (let i = 0; i < 3; i++) {
  assert.equal(takeRateLimit('t', 3, 60_000).allowed, true)
}
assert.equal(takeRateLimit('t', 3, 60_000).allowed, false)

console.log('google token security checks passed')
