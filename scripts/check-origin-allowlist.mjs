/**
 * Node smoke checks for server/originAllowlist.ts behavior.
 * Run: npx tsx scripts/check-origin-allowlist.mjs
 */
import assert from 'node:assert/strict'
import {
  googleCloudConsoleUris,
  isAllowedAppOrigin,
  isAllowedRedirectUri,
  normalizeOrigin,
  PUBLISHED_APP_ORIGIN,
  staticAllowedOrigins,
} from '../server/originAllowlist.ts'

const published = PUBLISHED_APP_ORIGIN
const internalUrl = 'http://127.0.0.1:8080/api/google/exchange'

assert.equal(normalizeOrigin(`${published}/`), published)
assert.equal(normalizeOrigin(`${published}/app?x=1`), published)
assert.equal(normalizeOrigin('null'), null)
assert.equal(normalizeOrigin('capacitor://localhost'), 'capacitor://localhost')
assert.equal(normalizeOrigin('capacitor://evil'), null)

// Live bug: browser Origin = published app, request.url is internal host URL
assert.equal(
  isAllowedAppOrigin({ origin: published }, internalUrl),
  true,
  'published Origin must pass even when request.url is internal',
)

// Referer-only (Origin omitted) with trailing slash — common mobile
assert.equal(
  isAllowedAppOrigin({ referer: `${published}/` }, internalUrl),
  true,
  'Referer-only with trailing slash must pass',
)

// www variant of published host
assert.equal(
  isAllowedAppOrigin(
    { origin: 'https://www.lumina-calendar-f5eb.apps.grok.bot' },
    internalUrl,
  ),
  true,
  'www variant of published origin must pass',
)

// Capacitor WebView
assert.equal(
  isAllowedAppOrigin({ origin: 'capacitor://localhost' }, internalUrl),
  true,
)
assert.equal(
  isAllowedAppOrigin({ origin: 'ionic://localhost' }, internalUrl),
  true,
)
assert.equal(
  isAllowedAppOrigin({ origin: 'https://localhost' }, internalUrl),
  true,
  'Capacitor androidScheme https://localhost must pass',
)

// Arbitrary / evil rejected
assert.equal(
  isAllowedAppOrigin({ origin: 'https://evil.example' }, internalUrl),
  false,
)
assert.equal(isAllowedAppOrigin({ origin: 'null' }, internalUrl), false)
assert.equal(
  isAllowedAppOrigin({ origin: 'capacitor://evil' }, internalUrl),
  false,
)

// Hardening: Host / X-Forwarded-Host must NOT expand Origin allowlist
assert.equal(
  isAllowedAppOrigin(
    {
      origin: 'https://evil.example',
      'x-forwarded-host': 'evil.example',
      'x-forwarded-proto': 'https',
    },
    internalUrl,
  ),
  false,
  'spoofed X-Forwarded-Host must not allow arbitrary Origin',
)

assert.equal(
  isAllowedAppOrigin(
    {
      origin: 'https://custom.example',
      'x-forwarded-host': 'custom.example',
      'x-forwarded-proto': 'https',
    },
    internalUrl,
  ),
  false,
  'custom host requires PUBLIC_APP_ORIGIN / ALLOWED_ORIGINS — not Host spoofing',
)

// Mobile privacy: no Origin/Referer, Sec-Fetch-Site same-origin + Host
assert.equal(
  isAllowedAppOrigin(
    {
      host: 'lumina-calendar-f5eb.apps.grok.bot',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
    },
    internalUrl,
  ),
  true,
)

// www Host + same-origin fetch metadata
assert.equal(
  isAllowedAppOrigin(
    {
      host: 'www.lumina-calendar-f5eb.apps.grok.bot',
      'sec-fetch-site': 'same-origin',
    },
    internalUrl,
  ),
  true,
)

// Missing Origin/Referer without same-origin metadata → reject
assert.equal(
  isAllowedAppOrigin(
    { host: 'lumina-calendar-f5eb.apps.grok.bot' },
    internalUrl,
  ),
  false,
)

assert.equal(
  isAllowedAppOrigin(
    {
      host: 'lumina-calendar-f5eb.apps.grok.bot',
      'sec-fetch-site': 'cross-site',
    },
    internalUrl,
  ),
  false,
)

assert.equal(
  isAllowedAppOrigin(
    { origin: 'http://127.0.0.1:5173' },
    'http://127.0.0.1:5173/api/google/exchange',
  ),
  true,
)

// redirect_uri: allowlisted origin / trailing slash only
assert.equal(isAllowedRedirectUri(published), true)
assert.equal(isAllowedRedirectUri(`${published}/`), true)
assert.equal(isAllowedRedirectUri('https://localhost'), true)
assert.equal(isAllowedRedirectUri('capacitor://localhost'), true)
assert.equal(isAllowedRedirectUri(`${published}/callback`), false)
assert.equal(isAllowedRedirectUri(`${published}?x=1`), false)
assert.equal(isAllowedRedirectUri('https://evil.example'), false)
assert.equal(isAllowedRedirectUri('https://evil.example/'), false)

const staticSet = staticAllowedOrigins()
assert.ok(staticSet.has(published))
assert.ok(!staticSet.has('https://evil.example'))

const uris = googleCloudConsoleUris()
assert.ok(uris.javascriptOrigins.includes(published))
assert.ok(uris.redirectUris.includes(`${published}/`))
assert.ok(uris.redirectUris.includes('https://localhost'))

console.log('origin allowlist checks passed')
