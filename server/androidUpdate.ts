/**
 * Resolve latest Android APK release for in-app updates.
 * Public repo: silent download via GitHub Releases API + browser_download_url
 * (no token). Optional GITHUB_TOKEN is only a fallback (rate limit / private).
 * Falls back to committed public/android-latest.json when GitHub is unreachable.
 */

export const ANDROID_UPDATE_OWNER = 'zambooty'
export const ANDROID_UPDATE_REPO = 'lumina-adhd-calendar'
export const ANDROID_TAG_PREFIXES = ['android-debug-', 'android-release-'] as const
/** Match Cap AppUpdatePlugin MAX_APK_BYTES — hard stop for proxy streams. */
export const MAX_APK_PROXY_BYTES = 80 * 1024 * 1024

export type AndroidLatestManifest = {
  versionCode: number
  versionName: string
  tag: string
  apkAsset: string
  /** Relative API path or absolute https URL. */
  apkUrl?: string
  /** GitHub browser download URL (works unauthenticated on public repos). */
  githubDownloadUrl?: string
  releaseUrl?: string
  sha256?: string
  publishedAt?: string
  notes?: string
  channel?: 'debug' | 'release'
}

export type ResolvedAndroidUpdate = AndroidLatestManifest & {
  ok: true
  source: 'github' | 'manifest'
  /** True when optional GITHUB_TOKEN is bound (proxy fallback). */
  proxyAvailable: boolean
  downloadUrl: string
  installHint: string
}

function readGithubToken(): string {
  return (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim()
}

export function githubAuthConfigured(): boolean {
  return readGithubToken().length > 0
}

function githubHeaders(accept = 'application/vnd.github+json'): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'lumina-android-update',
  }
  const token = readGithubToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export function isAndroidReleaseTag(tag: string): boolean {
  return ANDROID_TAG_PREFIXES.some((p) => tag.startsWith(p))
}

/** Pull versionCode from release body / name when present. */
export function parseVersionCode(
  body: string | null | undefined,
  name: string | null | undefined,
  fallback: number,
): number {
  const hay = `${name || ''}\n${body || ''}`
  const m = hay.match(/versionCode\s*[:=]\s*(\d+)/i)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return fallback
}

type GhAsset = {
  id: number
  name: string
  size: number
  url: string
  browser_download_url: string
  digest?: string | null
}

type GhRelease = {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  html_url: string
  draft: boolean
  prerelease: boolean
  assets: GhAsset[]
}

function pickApkAsset(assets: GhAsset[]): GhAsset | null {
  if (!assets?.length) return null
  const preferred = assets.find(
    (a) =>
      a.name === 'lumina-debug.apk' ||
      a.name === 'lumina-release.apk' ||
      a.name === 'lumina.apk',
  )
  if (preferred) return preferred
  return assets.find((a) => a.name.toLowerCase().endsWith('.apk')) ?? null
}

function shaFromDigest(digest: string | null | undefined): string | undefined {
  if (!digest) return undefined
  const m = digest.match(/sha256:([a-f0-9]{64})/i)
  return m ? m[1].toLowerCase() : undefined
}

function channelFromTag(tag: string): 'debug' | 'release' {
  return tag.startsWith('android-release-') ? 'release' : 'debug'
}

function publicDownloadUrl(tag: string, asset: string): string {
  return `https://github.com/${ANDROID_UPDATE_OWNER}/${ANDROID_UPDATE_REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`
}

function proxyDownloadPath(tag: string, asset: string): string {
  const q = new URLSearchParams({ tag, asset })
  return `/api/android/apk?${q.toString()}`
}

/**
 * Prefer public browser_download_url for silent Cap download (no token).
 * Optional app proxy is an alternate; token only helps if the asset is private.
 */
function pickDownloadUrl(opts: {
  browserUrl?: string
  tag: string
  asset: string
  apkUrl?: string
}): string {
  if (opts.browserUrl?.startsWith('https://')) return opts.browserUrl
  if (opts.apkUrl?.startsWith('https://')) return opts.apkUrl
  return publicDownloadUrl(opts.tag, opts.asset)
}

export async function fetchLatestGithubAndroidRelease(): Promise<
  ResolvedAndroidUpdate | { ok: false; error: string; hint: string }
> {
  const url =
    `https://api.github.com/repos/${ANDROID_UPDATE_OWNER}/${ANDROID_UPDATE_REPO}/releases?per_page=20`
  let res: Response
  try {
    res = await fetch(url, { headers: githubHeaders() })
  } catch (e) {
    return {
      ok: false,
      error: 'github_network',
      hint: e instanceof Error ? e.message : 'Could not reach GitHub.',
    }
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: 'github_rate_limited',
      hint:
        'GitHub Releases blocked (rate limit or auth). Retry later, keep public/android-latest.json current, or optionally bind GITHUB_TOKEN.',
    }
  }
  if (res.status === 404) {
    return {
      ok: false,
      error: 'github_not_found',
      hint:
        'GitHub Releases not found — check the repo name or keep public/android-latest.json current.',
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      error: `github_http_${res.status}`,
      hint: 'GitHub Releases request failed.',
    }
  }

  const releases = (await res.json()) as GhRelease[]
  const match = (releases || []).find(
    (r) =>
      !r.draft &&
      isAndroidReleaseTag(r.tag_name) &&
      pickApkAsset(r.assets || []),
  )
  if (!match) {
    return {
      ok: false,
      error: 'no_android_release',
      hint: 'No android-debug-* / android-release-* GitHub Release with an APK asset.',
    }
  }

  const asset = pickApkAsset(match.assets)!
  const proxyAvailable = githubAuthConfigured()
  const versionCode = parseVersionCode(match.body, match.name, 0)
  const versionName =
    match.name?.trim() ||
    match.tag_name.replace(/^android-(debug|release)-/, '') ||
    match.tag_name

  const downloadUrl = pickDownloadUrl({
    browserUrl: asset.browser_download_url,
    tag: match.tag_name,
    asset: asset.name,
  })

  return {
    ok: true,
    source: 'github',
    proxyAvailable,
    versionCode: versionCode > 0 ? versionCode : 1,
    versionName,
    tag: match.tag_name,
    apkAsset: asset.name,
    githubDownloadUrl: asset.browser_download_url,
    releaseUrl: match.html_url,
    sha256: shaFromDigest(asset.digest),
    publishedAt: match.published_at || undefined,
    notes: match.body || undefined,
    channel: channelFromTag(match.tag_name),
    downloadUrl,
    installHint:
      'Download the public GitHub Release APK, then open the system installer.',
  }
}

export function resolveFromManifest(
  manifest: AndroidLatestManifest,
): ResolvedAndroidUpdate {
  const proxyAvailable = githubAuthConfigured()
  const downloadUrl = pickDownloadUrl({
    browserUrl: manifest.githubDownloadUrl,
    apkUrl: manifest.apkUrl,
    tag: manifest.tag,
    asset: manifest.apkAsset,
  })

  return {
    ok: true,
    source: 'manifest',
    proxyAvailable,
    versionCode: manifest.versionCode,
    versionName: manifest.versionName,
    tag: manifest.tag,
    apkAsset: manifest.apkAsset,
    apkUrl: manifest.apkUrl,
    githubDownloadUrl:
      manifest.githubDownloadUrl ||
      publicDownloadUrl(manifest.tag, manifest.apkAsset),
    releaseUrl:
      manifest.releaseUrl ||
      `https://github.com/${ANDROID_UPDATE_OWNER}/${ANDROID_UPDATE_REPO}/releases/tag/${encodeURIComponent(manifest.tag)}`,
    sha256: manifest.sha256,
    publishedAt: manifest.publishedAt,
    notes: manifest.notes,
    channel: manifest.channel || channelFromTag(manifest.tag),
    downloadUrl,
    installHint:
      'Download the public GitHub Release APK, then open the system installer.',
  }
}

/** Stream a release asset. Public repos need no token; token is optional fallback. */
export async function fetchGithubReleaseAsset(opts: {
  tag: string
  asset: string
}): Promise<
  | {
      ok: true
      body: ReadableStream<Uint8Array> | null
      size: number | null
      contentType: string
      filename: string
    }
  | { ok: false; status: number; error: string; hint: string }
> {
  const tag = opts.tag.trim()
  const asset = opts.asset.trim()
  if (!tag || !asset || asset.includes('/') || asset.includes('..')) {
    return {
      ok: false,
      status: 400,
      error: 'bad_request',
      hint: 'tag and asset are required.',
    }
  }
  if (!isAndroidReleaseTag(tag)) {
    return {
      ok: false,
      status: 400,
      error: 'bad_tag',
      hint: 'Only android-debug-* / android-release-* tags are allowed.',
    }
  }
  if (!asset.toLowerCase().endsWith('.apk')) {
    return {
      ok: false,
      status: 400,
      error: 'bad_asset',
      hint: 'Only .apk assets are allowed.',
    }
  }

  const metaUrl =
    `https://api.github.com/repos/${ANDROID_UPDATE_OWNER}/${ANDROID_UPDATE_REPO}/releases/tags/${encodeURIComponent(tag)}`
  let metaRes: Response
  try {
    metaRes = await fetch(metaUrl, { headers: githubHeaders() })
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: 'github_network',
      hint: e instanceof Error ? e.message : 'Could not reach GitHub.',
    }
  }

  if (!metaRes.ok) {
    return {
      ok: false,
      status: metaRes.status === 404 ? 404 : 502,
      error: 'release_lookup_failed',
      hint:
        metaRes.status === 401 || metaRes.status === 403
          ? 'GitHub blocked the release lookup (rate limit). Retry later or optionally bind GITHUB_TOKEN.'
          : 'Could not load GitHub release metadata.',
    }
  }

  const release = (await metaRes.json()) as GhRelease
  const withId = (release.assets || []).find((a) => a.name === asset)
  if (!withId) {
    return {
      ok: false,
      status: 404,
      error: 'asset_not_found',
      hint: `No asset named ${asset} on ${tag}.`,
    }
  }

  const declaredSize = typeof withId.size === 'number' ? withId.size : null
  if (declaredSize != null && declaredSize > MAX_APK_PROXY_BYTES) {
    return {
      ok: false,
      status: 413,
      error: 'apk_too_large',
      hint: 'APK exceeds the proxy size limit.',
    }
  }

  // 1) Public browser URL (no auth) — preferred for silent Cap download via proxy too.
  if (withId.browser_download_url) {
    try {
      const publicRes = await fetch(withId.browser_download_url, {
        headers: {
          Accept: 'application/vnd.android.package-archive,*/*',
          'User-Agent': 'lumina-android-update',
        },
        redirect: 'follow',
      })
      if (publicRes.ok) {
        return {
          ok: true,
          body: limitApkStream(publicRes.body),
          size: declaredSize,
          contentType: 'application/vnd.android.package-archive',
          filename: withId.name,
        }
      }
    } catch {
      /* fall through to API asset URL */
    }
  }

  // 2) GitHub API asset URL — works publicly for public repos; token helps if private.
  if (!withId.url) {
    return {
      ok: false,
      status: 404,
      error: 'asset_api_missing',
      hint: 'GitHub asset API URL missing.',
    }
  }

  const apkRes = await fetch(withId.url, {
    headers: githubHeaders('application/octet-stream'),
    redirect: 'follow',
  })
  if (!apkRes.ok) {
    return {
      ok: false,
      status: apkRes.status === 404 ? 404 : 502,
      error: 'asset_download_failed',
      hint:
        apkRes.status === 401 || apkRes.status === 403
          ? 'Asset download blocked — if the release is private, optionally bind GITHUB_TOKEN; otherwise open the GitHub release page.'
          : `GitHub asset download failed (HTTP ${apkRes.status}).`,
    }
  }

  return {
    ok: true,
    body: limitApkStream(apkRes.body),
    size: declaredSize,
    contentType: 'application/vnd.android.package-archive',
    filename: withId.name,
  }
}

/** Abort the proxy body once it exceeds MAX_APK_PROXY_BYTES. */
function limitApkStream(
  body: ReadableStream<Uint8Array> | null,
): ReadableStream<Uint8Array> | null {
  if (!body) return null
  let total = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength
        if (total > MAX_APK_PROXY_BYTES) {
          controller.error(new Error('apk_too_large'))
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )
}

/** Exposed for tests / callers that need the proxy path explicitly. */
export function androidProxyDownloadPath(tag: string, asset: string): string {
  return proxyDownloadPath(tag, asset)
}
