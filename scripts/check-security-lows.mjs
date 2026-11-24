/**
 * Checks for remaining low-severity hardenings:
 * - Cap OAuth return URL scheme/host allowlist + safe assign href
 * - Android APK tag shape + redirect-without-API
 */
import assert from 'node:assert/strict'
import {
  isTrustedOAuthReturnUrl,
  safeOAuthReturnAssignHref,
} from '../src/lib/oauthReturnUrl.ts'
import {
  clearAndroidUpdateCache,
  fetchGithubReleaseAsset,
  isAndroidReleaseTag,
  rememberKnownApkTag,
} from '../server/androidUpdate.ts'

const BASE = 'https://localhost'

// OAuth return scheme / host
{
  assert.equal(
    isTrustedOAuthReturnUrl(new URL('https://localhost/?code=abc&state=x')),
    true,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(new URL('http://127.0.0.1/?code=abc')),
    true,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(
      new URL('https://lumina-calendar-f5eb.apps.grok.bot/?code=abc'),
    ),
    true,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(new URL('capacitor://localhost/?code=abc')),
    true,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(new URL('https://evil.example/?code=abc')),
    false,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(new URL('javascript:alert(1)?code=abc')),
    false,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(new URL('capacitor://evil/?code=abc')),
    false,
  )
  assert.equal(
    isTrustedOAuthReturnUrl(
      new URL('https://user:pass@localhost/?code=abc'),
    ),
    false,
  )
}

// Cap OAuth assign href — same-origin path + allowlisted query only
{
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://localhost/?code=abc&state=xyz'),
      BASE,
    ),
    '/?code=abc&state=xyz',
  )
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://localhost/?code=abc&evil=https://phish.example'),
      BASE,
    ),
    '/?code=abc',
  )
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://localhost//@evil.com/?code=abc'),
      BASE,
    ),
    null,
  )
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://localhost/\\evil.com?code=abc'),
      BASE,
    ),
    null,
  )
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://localhost/foo?code=abc'),
      BASE,
    ),
    null,
  )
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://evil.example/?code=abc'),
      BASE,
    ),
    null,
  )
  assert.equal(
    safeOAuthReturnAssignHref(
      new URL('https://localhost/?code=abc#/redirect'),
      BASE,
    ),
    '/?code=abc',
  )
  assert.equal(
    safeOAuthReturnAssignHref(new URL('https://localhost/?state=only'), BASE),
    null,
  )
}

// Android tag shape
{
  assert.equal(isAndroidReleaseTag('android-debug-2026-11-24-1.1.3'), true)
  assert.equal(isAndroidReleaseTag('android-release-2026-11-24-2.0.0'), true)
  assert.equal(isAndroidReleaseTag('android-debug-'), false)
  assert.equal(isAndroidReleaseTag('android-debug-probe'), false)
  assert.equal(isAndroidReleaseTag('android-debug-2026-11-24'), false)
  assert.equal(isAndroidReleaseTag('v1.0.0'), false)
}

// APK redirect: no GitHub API; unknown stream tags rejected
{
  clearAndroidUpdateCache()
  const redirect = await fetchGithubReleaseAsset({
    tag: 'android-debug-2026-11-24-1.1.3',
    asset: 'lumina-debug.apk',
    preferRedirect: true,
  })
  assert.equal(redirect.ok, true)
  if (redirect.ok) {
    assert.equal(redirect.mode, 'redirect')
    assert.match(
      redirect.url,
      /\/releases\/download\/android-debug-2026-11-24-1\.1\.3\/lumina-debug\.apk$/,
    )
  }

  const badAsset = await fetchGithubReleaseAsset({
    tag: 'android-debug-2026-11-24-1.1.3',
    asset: 'evil.apk',
    preferRedirect: true,
  })
  assert.equal(badAsset.ok, false)
  if (!badAsset.ok) assert.equal(badAsset.error, 'bad_asset')

  const streamUnknown = await fetchGithubReleaseAsset({
    tag: 'android-debug-2099-01-01-evil',
    asset: 'lumina-debug.apk',
    preferRedirect: false,
  })
  assert.equal(streamUnknown.ok, false)
  if (!streamUnknown.ok) assert.equal(streamUnknown.error, 'tag_not_known')

  rememberKnownApkTag('android-debug-2026-11-24-1.1.3')
  // Known tag still may fail network lookup in CI — only assert gate opens past tag_not_known.
  const streamKnown = await fetchGithubReleaseAsset({
    tag: 'android-debug-2026-11-24-1.1.3',
    asset: 'lumina-debug.apk',
    preferRedirect: false,
  })
  if (!streamKnown.ok) {
    assert.notEqual(streamKnown.error, 'tag_not_known')
  }
}

console.log('security lows checks passed')
