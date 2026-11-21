/**
 * Resolve latest Android APK release for in-app updates.
 * Prefers GitHub Releases (optional GITHUB_TOKEN for private repo),
 * falls back to committed public/android-latest.json values when provided.
 */

export const ANDROID_UPDATE_OWNER = 'zambooty'
export const ANDROID_UPDATE_REPO = 'lumina-adhd-calendar'
export const ANDROID_TAG_PREFIXES = ['android-debug-', 'android-release-'] as const

export type AndroidLatestManifest = {
  versionCode: number
  versionName: string
  tag: string
  apkAsset: string
  /** Relative API path or absolute https URL used when proxy/token available. */
  apkUrl?: string
  /** Public GitHub browser download URL (may 404 on private repos). */
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

function proxyDownloadPath(tag: string, asset: string): string {
  const q = new URLSearchParams({ tag, asset })
  return `/api/android/apk?${q.toString()}`
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

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return {
      ok: false,
      error: 'github_auth_required',
      hint:
        'Private repo — bind GITHUB_TOKEN (Contents: Read) on the published app, or keep public/android-latest.json current.',
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

  const downloadUrl = proxyAvailable
    ? proxyDownloadPath(match.tag_name, asset.name)
    : asset.browser_download_url

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
    installHint: proxyAvailable
      ? 'Download via published proxy, then open the system installer.'
      : 'Private assets need GITHUB_TOKEN for in-app download; otherwise open the GitHub release page.',
  }
}

export function resolveFromManifest(
  manifest: AndroidLatestManifest,
): ResolvedAndroidUpdate {
  const proxyAvailable = githubAuthConfigured()
  const downloadUrl = proxyAvailable
    ? proxyDownloadPath(manifest.tag, manifest.apkAsset)
    : manifest.apkUrl ||
      manifest.githubDownloadUrl ||
      `https://github.com/${ANDROID_UPDATE_OWNER}/${ANDROID_UPDATE_REPO}/releases/download/${encodeURIComponent(manifest.tag)}/${encodeURIComponent(manifest.apkAsset)}`

  return {
    ok: true,
    source: 'manifest',
    proxyAvailable,
    versionCode: manifest.versionCode,
    versionName: manifest.versionName,
    tag: manifest.tag,
    apkAsset: manifest.apkAsset,
    apkUrl: manifest.apkUrl,
    githubDownloadUrl: manifest.githubDownloadUrl,
    releaseUrl:
      manifest.releaseUrl ||
      `https://github.com/${ANDROID_UPDATE_OWNER}/${ANDROID_UPDATE_REPO}/releases/tag/${encodeURIComponent(manifest.tag)}`,
    sha256: manifest.sha256,
    publishedAt: manifest.publishedAt,
    notes: manifest.notes,
    channel: manifest.channel || channelFromTag(manifest.tag),
    downloadUrl,
    installHint: proxyAvailable
      ? 'Download via published proxy, then open the system installer.'
      : 'Bind GITHUB_TOKEN for private in-app APK download, or open the release page.',
  }
}

/** Stream a release asset (requires token for private repos). */
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
        metaRes.status === 401 || metaRes.status === 403 || metaRes.status === 404
          ? 'Bind GITHUB_TOKEN with Contents: Read for private release downloads.'
          : 'Could not load GitHub release metadata.',
    }
  }

  const release = (await metaRes.json()) as GhRelease
  const found = pickApkAsset(
    (release.assets || []).filter((a) => a.name === asset),
  )
  const withId = (release.assets || []).find((a) => a.name === asset)
  if (!withId?.url) {
    return {
      ok: false,
      status: 404,
      error: 'asset_not_found',
      hint: `No asset named ${asset} on ${tag}.`,
    }
  }
  void found

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
          ? 'GITHUB_TOKEN cannot download this private asset.'
          : `GitHub asset download failed (HTTP ${apkRes.status}).`,
    }
  }

  return {
    ok: true,
    body: apkRes.body,
    size: withId.size ?? null,
    contentType: 'application/vnd.android.package-archive',
    filename: withId.name,
  }
}
