/**
 * Capacitor AppUpdate bridge — GitHub Release APK check / download / install.
 * Web: no-ops with honest unavailable status.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { apiFetch, apiUrl } from './apiBase'
import { isAndroidNative } from './platform'

export type InstalledVersion = {
  ok: boolean
  applicationId: string
  versionName: string
  versionCode: number
  error?: string
}

export type InstallPermission = {
  ok: boolean
  allowed: boolean
  needsSettings: boolean
}

export type DownloadInstallResult = {
  ok: boolean
  error?: string
  hint?: string
  path?: string
  needsSettings?: boolean
  openedInstaller?: boolean
}

export type AppUpdatePlugin = {
  getInstalledVersion(): Promise<InstalledVersion>
  canRequestPackageInstalls(): Promise<InstallPermission>
  openInstallPermissionSettings(): Promise<{ ok: boolean; error?: string }>
  downloadAndInstall(options: {
    url: string
    fileName?: string
  }): Promise<DownloadInstallResult>
  installDownloadedApk(options: {
    path: string
  }): Promise<DownloadInstallResult>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: {
      percent: number
      bytes: number
      total: number
    }) => void,
  ): Promise<PluginListenerHandle>
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')

export type LatestUpdateInfo = {
  ok: boolean
  versionCode: number
  versionName: string
  tag: string
  apkAsset: string
  downloadUrl: string
  releaseUrl?: string
  githubDownloadUrl?: string
  sha256?: string
  publishedAt?: string
  notes?: string
  channel?: 'debug' | 'release'
  source?: 'github' | 'manifest'
  proxyAvailable?: boolean
  githubAuthConfigured?: boolean
  installHint?: string
  error?: string
  hint?: string
}

export type UpdateCheckResult = {
  available: boolean
  installed: InstalledVersion | null
  latest: LatestUpdateInfo | null
  error?: string
  hint?: string
}

export function appUpdateAvailable(): boolean {
  return isAndroidNative()
}

function absoluteDownloadUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('http://')) {
    return pathOrUrl
  }
  return apiUrl(pathOrUrl)
}

async function fetchLatestUpdate(): Promise<LatestUpdateInfo> {
  try {
    const res = await apiFetch('/api/android/update', { method: 'GET' })
    const data = (await res.json()) as LatestUpdateInfo
    if (data?.ok && data.downloadUrl) {
      return {
        ...data,
        downloadUrl: absoluteDownloadUrl(data.downloadUrl),
      }
    }
    if (!res.ok || data?.ok === false) {
      // Fall back to static manifest on published host / Cap absolute origin.
      return await fetchStaticManifest(data)
    }
  } catch {
    /* try static */
  }
  return await fetchStaticManifest()
}

async function fetchStaticManifest(
  prior?: LatestUpdateInfo,
): Promise<LatestUpdateInfo> {
  try {
    const res = await apiFetch('/android-latest.json', { method: 'GET' })
    if (!res.ok) {
      return {
        ok: false,
        versionCode: 0,
        versionName: '',
        tag: '',
        apkAsset: '',
        downloadUrl: '',
        error: prior?.error || 'update_check_failed',
        hint:
          prior?.hint ||
          'Could not reach update metadata. Check network / published app.',
      }
    }
    const m = (await res.json()) as {
      versionCode: number
      versionName: string
      tag: string
      apkAsset: string
      githubDownloadUrl?: string
      releaseUrl?: string
      sha256?: string
      publishedAt?: string
      notes?: string
      channel?: 'debug' | 'release'
    }
    // Public GitHub browser URL first (no token). Proxy is optional fallback.
    const downloadUrl = absoluteDownloadUrl(
      m.githubDownloadUrl ||
        `https://github.com/zambooty/lumina-adhd-calendar/releases/download/${encodeURIComponent(m.tag)}/${encodeURIComponent(m.apkAsset)}`,
    )
    return {
      ok: true,
      source: 'manifest',
      versionCode: m.versionCode,
      versionName: m.versionName,
      tag: m.tag,
      apkAsset: m.apkAsset,
      downloadUrl,
      githubDownloadUrl: m.githubDownloadUrl,
      releaseUrl: m.releaseUrl,
      sha256: m.sha256,
      publishedAt: m.publishedAt,
      notes: m.notes,
      channel: m.channel,
      proxyAvailable: prior?.githubAuthConfigured === true,
      installHint:
        'Download the public GitHub Release APK, then open the system installer.',
      githubAuthConfigured: prior?.githubAuthConfigured,
    }
  } catch (e) {
    return {
      ok: false,
      versionCode: 0,
      versionName: '',
      tag: '',
      apkAsset: '',
      downloadUrl: '',
      error: 'update_check_failed',
      hint: e instanceof Error ? e.message : 'Update check failed.',
    }
  }
}

export async function getInstalledVersion(): Promise<InstalledVersion | null> {
  if (!isAndroidNative()) return null
  try {
    return await AppUpdate.getInstalledVersion()
  } catch {
    return null
  }
}

/**
 * Compare installed versionCode to latest GitHub / android-latest.json.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isAndroidNative()) {
    return {
      available: false,
      installed: null,
      latest: null,
      error: 'web_only',
      hint: 'In-app APK updates are Android Cap only.',
    }
  }

  const installed = await getInstalledVersion()
  const latest = await fetchLatestUpdate()

  if (!latest.ok) {
    return {
      available: false,
      installed,
      latest,
      error: latest.error,
      hint: latest.hint,
    }
  }

  const installedCode = installed?.versionCode ?? 0
  const available = latest.versionCode > installedCode

  return {
    available,
    installed,
    latest,
    hint: available
      ? undefined
      : `You’re on ${installed?.versionName || installedCode} (latest ${latest.versionName || latest.tag}).`,
  }
}

export async function ensureInstallPermission(): Promise<{
  allowed: boolean
  openedSettings: boolean
  hint?: string
}> {
  if (!isAndroidNative()) {
    return { allowed: false, openedSettings: false, hint: 'Android only.' }
  }
  const state = await AppUpdate.canRequestPackageInstalls()
  if (state.allowed) return { allowed: true, openedSettings: false }
  await AppUpdate.openInstallPermissionSettings()
  return {
    allowed: false,
    openedSettings: true,
    hint: 'Allow install from LUMINA in system settings, then tap Install again.',
  }
}

export async function downloadAndInstallUpdate(
  latest: LatestUpdateInfo,
  onProgress?: (percent: number) => void,
): Promise<DownloadInstallResult> {
  if (!isAndroidNative()) {
    return { ok: false, error: 'web_only', hint: 'Android only.' }
  }

  let handle: PluginListenerHandle | undefined
  if (onProgress) {
    handle = await AppUpdate.addListener('downloadProgress', (e) => {
      onProgress(e.percent)
    })
  }

  try {
    const perm = await AppUpdate.canRequestPackageInstalls()
    if (perm.needsSettings && !perm.allowed) {
      await AppUpdate.openInstallPermissionSettings()
      return {
        ok: false,
        error: 'install_permission_required',
        hint: 'Allow LUMINA to install unknown apps, then tap Download & install again.',
        needsSettings: true,
      }
    }

    const result = await AppUpdate.downloadAndInstall({
      url: latest.downloadUrl,
      fileName: latest.apkAsset || 'lumina-update.apk',
    })

    if (
      !result.ok &&
      result.needsSettings &&
      result.path
    ) {
      await AppUpdate.openInstallPermissionSettings()
      return result
    }

    // Download failed — keep a clear hint; sheet still offers Open GitHub release.
    if (
      !result.ok &&
      (result.error === 'apk_auth_required' ||
        result.error === 'apk_not_found' ||
        result.error === 'download_http_404')
    ) {
      return {
        ...result,
        hint:
          result.hint ||
          'Could not download the APK — open the GitHub release, or retry later.',
      }
    }

    return result
  } finally {
    await handle?.remove()
  }
}

export async function retryInstallFromPath(
  path: string,
): Promise<DownloadInstallResult> {
  if (!isAndroidNative()) {
    return { ok: false, error: 'web_only' }
  }
  const perm = await AppUpdate.canRequestPackageInstalls()
  if (!perm.allowed) {
    await AppUpdate.openInstallPermissionSettings()
    return {
      ok: false,
      error: 'install_permission_required',
      hint: 'Allow unknown apps for LUMINA, then tap Install again.',
      needsSettings: true,
      path,
    }
  }
  return AppUpdate.installDownloadedApk({ path })
}

export async function openReleaseInBrowser(
  latest: LatestUpdateInfo,
): Promise<void> {
  const url =
    latest.releaseUrl ||
    latest.githubDownloadUrl ||
    `https://github.com/zambooty/lumina-adhd-calendar/releases`
  await Browser.open({ url })
}

const DISMISS_KEY = 'lumina.update.dismissedTag'
const LAST_CHECK_KEY = 'lumina.update.lastCheckMs'

export function wasUpdateDismissed(tag: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === tag
  } catch {
    return false
  }
}

export function dismissUpdateTag(tag: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, tag)
  } catch {
    /* ignore */
  }
}

export function shouldAutoCheckUpdates(minIntervalMs = 6 * 60 * 60 * 1000): boolean {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY)
    const last = raw ? Number(raw) : 0
    if (!Number.isFinite(last) || last <= 0) return true
    return Date.now() - last >= minIntervalMs
  } catch {
    return true
  }
}

export function markUpdateChecked(): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}
