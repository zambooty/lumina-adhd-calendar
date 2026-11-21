/**
 * Node smoke checks for server/originAllowlist.ts behavior.
 * Run: node --experimental-strip-types scripts/check-origin-allowlist.mjs
 *   or: npx tsx scripts/check-origin-allowlist.mjs
 */
import assert from 'node:assert/strict'
import {
  googleCloudConsoleUris,
  isAllowedAppOrigin,
  normalizeOrigin,
  PUBLISHED_APP_ORIGIN,
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

// X-Forwarded-Host reconstructs public origin
assert.equal(
  isAllowedAppOrigin(
    {
      origin: 'https://custom.example',
      'x-forwarded-host': 'custom.example',
      'x-forwarded-proto': 'https',
    },
    internalUrl,
  ),
  true,
)

assert.equal(
  isAllowedAppOrigin(
    { origin: 'http://127.0.0.1:5173' },
    'http://127.0.0.1:5173/api/google/exchange',
  ),
  true,
)

const uris = googleCloudConsoleUris()
assert.ok(uris.javascriptOrigins.includes(published))
assert.ok(uris.redirectUris.includes(`${published}/`))

console.log('origin allowlist checks passed')
