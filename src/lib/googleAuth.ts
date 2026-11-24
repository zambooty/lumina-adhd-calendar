import { fetchGoogleConfig } from './googleConfig'
import {
  GOOGLE_SCOPES,
  hasRequiredGoogleScopes,
  missingGoogleScopes,
  parseScopeString,
} from './googleScopes'
import { apiFetch } from './apiBase'
import { isNativeCapacitor } from './platform'

const TOKEN_KEY = 'lumina_google_access_v1'
const OAUTH_STATE_KEY = 'lumina_google_oauth_state_v1'
const REDIRECT_URI_KEY = 'lumina_google_redirect_uri_v1'
const AUTH_FLASH_KEY = 'lumina_google_auth_flash'

type StoredToken = {
  accessToken: string
  expiresAt: number
  scope?: string
  refreshToken?: string
}

/** In-memory mirror — dies with the page; preferred over durable storage. */
let memoryToken: StoredToken | null = null

/**
 * Never persist Google tokens in localStorage (XSS / shared-device risk).
 * Cap + web both use memory + sessionStorage only. Clears any legacy bridge.
 */
function clearLocalStorageTokenBridge(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

type TokenClient = {
  requestAccessToken: (overrideConfig?: {
    prompt?: string
    scope?: string
  }) => void
}

type GisOauth2 = {
  initTokenClient: (config: {
    client_id: string
    scope: string
    include_granted_scopes?: boolean
    callback: (resp: {
      access_token?: string
      expires_in?: number
      scope?: string
      error?: string
    }) => void
  }) => TokenClient
  revoke: (token: string, done?: () => void) => void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } }
  }
}

let scriptPromise: Promise<void> | null = null
let hydratePromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-lumina-gis]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity Services')),
      )
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.dataset.luminaGis = '1'
    s.onload = () => resolve()
    s.onerror = () =>
      reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * Canonical OAuth redirect_uri sent to Google (auth + token exchange).
 * Exact string: `${window.location.origin}` — no path, no trailing slash.
 *
 * Google Cloud Console → Credentials → OAuth Web client must include the
 * exact JS origins + redirect URIs listed in README (published + local,
 * with and without trailing slash on redirect URIs).
 */
export function getOAuthRedirectUri(): string {
  return window.location.origin
}

/** Register these exact redirect URIs (published host + local). */
export function recommendedRedirectUris(origin = getOAuthRedirectUri()): string[] {
  const base = origin.replace(/\/$/, '')
  return [base, `${base}/`]
}

function parseTokenRaw(raw: string | null): StoredToken | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredToken
    if (typeof parsed !== 'object' || parsed == null) return null
    return parsed
  } catch {
    return null
  }
}

function readStored(): StoredToken | null {
  try {
    // Always scrub legacy localStorage bridge (Cap + web).
    clearLocalStorageTokenBridge()

    // Prefer memory → sessionStorage only (tab / Cap WebView lifetime).
    const candidates: StoredToken[] = []
    if (memoryToken) candidates.push(memoryToken)
    const session = parseTokenRaw(sessionStorage.getItem(TOKEN_KEY))
    if (session) candidates.push(session)

    let best: StoredToken | null = null
    for (const parsed of candidates) {
      const hasAccess =
        Boolean(parsed.accessToken) &&
        typeof parsed.expiresAt === 'number' &&
        Date.now() < parsed.expiresAt - 30_000
      const hasRefresh = Boolean(parsed.refreshToken)
      if (!hasAccess && !hasRefresh) continue
      best = {
        accessToken: hasAccess ? parsed.accessToken : '',
        expiresAt: hasAccess ? parsed.expiresAt : 0,
        scope: parsed.scope,
        refreshToken: hasRefresh ? parsed.refreshToken : undefined,
      }
      if (hasAccess) break
    }

    if (!best) return null

    if (!best.accessToken && best.refreshToken) {
      writeStoredRaw(best)
    }
    return best
  } catch {
    return null
  }
}

function writeStoredRaw(token: StoredToken): void {
  memoryToken = token

  // Session: full token for tab / Cap WebView lifetime (survives soft reloads).
  // Never log this blob — it contains bearer material. Never use localStorage.
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  } catch {
    /* private mode */
  }
  clearLocalStorageTokenBridge()
}

function writeStored(token: StoredToken): void {
  const prev = memoryToken ?? parseTokenRaw(sessionStorage.getItem(TOKEN_KEY))
  const refreshToken = token.refreshToken ?? prev?.refreshToken
  writeStoredRaw({
    ...token,
    refreshToken,
    scope: token.scope ?? prev?.scope,
  })
}

export function clearGoogleToken(): void {
  let existing: StoredToken | null = memoryToken
  if (!existing) {
    try {
      existing =
        parseTokenRaw(sessionStorage.getItem(TOKEN_KEY)) ??
        parseTokenRaw(localStorage.getItem(TOKEN_KEY))
    } catch {
      existing = null
    }
  }
  memoryToken = null
  clearLocalStorageTokenBridge()
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  if (existing?.accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(existing.accessToken)
    } catch {
      /* ignore */
    }
  }
}

export function getGoogleAccessToken(): string | null {
  const stored = readStored()
  if (!stored?.accessToken) return null
  return stored.accessToken
}

export function getGoogleGrantedScopes(): string | null {
  const stored = readStored()
  return typeof stored?.scope === 'string' ? stored.scope : null
}

export function isGoogleConnected(): boolean {
  return Boolean(getGoogleAccessToken())
}

/** True when stored token scopes include calendar.readonly + gmail.readonly. */
export function hasStoredRequiredScopes(): boolean {
  const scope = getGoogleGrantedScopes()
  // Unknown scope (legacy token) — don't false-positive; let API decide.
  if (!scope) return true
  return hasRequiredGoogleScopes(scope)
}

/** Rough mobile / in-app browser detection — GIS popups often blank the page. */
export function prefersRedirectOAuth(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  const narrow =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 900px)').matches
  const mobileUa =
    /Android|iPhone|iPad|iPod|Mobile|CriOS|FxiOS|EdgiOS|Opera Mini|IEMobile/i.test(
      ua,
    )
  return mobileUa || (coarse && narrow)
}

function clearOAuthParamsFromUrl(): void {
  const url = new URL(window.location.href)
  ;[
    'code',
    'scope',
    'authuser',
    'prompt',
    'state',
    'error',
    'error_description',
  ].forEach((k) => url.searchParams.delete(k))
  const cleaned = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, document.title, cleaned || '/')
}

async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{
  ok: boolean
  error?: string
}> {
  const body = JSON.stringify({
    code,
    redirectUri,
  })
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
  }

  let res = await apiFetch('/api/google/exchange', {
    method: 'POST',
    headers,
    body,
  })
  if (res.status === 404) {
    res = await apiFetch('/api/google/exchange/route', {
      method: 'POST',
      headers,
      body,
    })
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string
    }
    return { ok: false, error: payload.error ?? `exchange_${res.status}` }
  }

  const payload = (await res.json()) as {
    accessToken?: string
    expiresIn?: number
    scope?: string
    refreshToken?: string | null
  }
  if (!payload.accessToken) {
    return { ok: false, error: 'exchange_no_token' }
  }

  const scope =
    typeof payload.scope === 'string' ? payload.scope : GOOGLE_SCOPES
  writeStored({
    accessToken: payload.accessToken,
    expiresAt: Date.now() + Number(payload.expiresIn ?? 3600) * 1000,
    scope,
    refreshToken: payload.refreshToken ?? undefined,
  })

  if (!hasRequiredGoogleScopes(scope)) {
    return {
      ok: false,
      error: `missing_scopes:${missingGoogleScopes(scope).join(',')}`,
    }
  }
  return { ok: true }
}

async function refreshWithStoredToken(): Promise<string | null> {
  const refreshToken = readStored()?.refreshToken
  if (!refreshToken) return null

  const body = JSON.stringify({ refreshToken })
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  let res = await apiFetch('/api/google/refresh', {
    method: 'POST',
    headers,
    body,
  })
  if (res.status === 404) {
    res = await apiFetch('/api/google/refresh/route', {
      method: 'POST',
      headers,
      body,
    })
  }
  if (!res.ok) return null
  const payload = (await res.json()) as {
    accessToken?: string
    expiresIn?: number
    scope?: string
  }
  if (!payload.accessToken) return null
  writeStored({
    accessToken: payload.accessToken,
    expiresAt: Date.now() + Number(payload.expiresIn ?? 3600) * 1000,
    scope:
      typeof payload.scope === 'string'
        ? payload.scope
        : getGoogleGrantedScopes() ?? undefined,
    refreshToken,
  })
  return payload.accessToken
}

/**
 * Finish redirect OAuth if the URL carries an auth code.
 * Call once at boot so mobile returns from Google land on a working app.
 */
export async function hydrateGoogleAuthFromRedirect(): Promise<{
  handled: boolean
  ok?: boolean
  error?: string
}> {
  if (hydratePromise) {
    await hydratePromise
    return { handled: false }
  }

  hydratePromise = (async () => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    const code = params.get('code')
    if (!err && !code) return

    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY)
    const state = params.get('state')
    // Prefer the URI we started with; fall back to canonical.
    const redirectUri =
      sessionStorage.getItem(REDIRECT_URI_KEY) || getOAuthRedirectUri()
    // Google may echo granted scopes on the redirect URL — keep as hint.
    const redirectScope = params.get('scope')

    clearOAuthParamsFromUrl()
    sessionStorage.removeItem(OAUTH_STATE_KEY)
    sessionStorage.removeItem(REDIRECT_URI_KEY)

    if (err) {
      sessionStorage.setItem(
        AUTH_FLASH_KEY,
        err === 'access_denied' ? 'auth_denied' : err,
      )
      return
    }

    // Require CSRF state on every code exchange — missing state is not OK.
    if (!expectedState || !state || expectedState !== state) {
      sessionStorage.setItem(AUTH_FLASH_KEY, 'state_mismatch')
      return
    }

    if (!code) {
      sessionStorage.setItem(AUTH_FLASH_KEY, 'exchange_failed')
      return
    }

    const result = await exchangeCode(code, redirectUri)
    if (result.ok && redirectScope && !getGoogleGrantedScopes()) {
      const stored = readStored()
      if (stored?.accessToken) {
        writeStored({ ...stored, scope: redirectScope })
      }
    }
    sessionStorage.setItem(
      AUTH_FLASH_KEY,
      result.ok ? 'connected' : result.error ?? 'exchange_failed',
    )
  })()

  try {
    await hydratePromise
    const flash = sessionStorage.getItem(AUTH_FLASH_KEY)
    if (!flash) return { handled: false }
    return {
      handled: true,
      ok: flash === 'connected',
      error: flash === 'connected' ? undefined : flash,
    }
  } finally {
    hydratePromise = null
  }
}

export function consumeGoogleAuthFlash(): string | null {
  const flash = sessionStorage.getItem(AUTH_FLASH_KEY)
  if (flash) sessionStorage.removeItem(AUTH_FLASH_KEY)
  return flash
}

function buildGoogleAuthUrl(
  clientId: string,
  scopes: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/** Cap Browser.open can hang forever on a stuck controller / raced opens. */
const CAP_BROWSER_OPEN_TIMEOUT_MS = 8_000

/** Serialize Cap Custom Tabs opens — parallel open() races the static listener. */
let capBrowserOpenChain: Promise<unknown> = Promise.resolve()

async function openCapCustomTab(
  authUrl: string,
): Promise<'opened' | 'timeout' | 'failed'> {
  const run = async (): Promise<'opened' | 'timeout' | 'failed'> => {
    try {
      const { Browser } = await import('@capacitor/browser')
      let timer: number | undefined
      try {
        await Promise.race([
          Browser.open({ url: authUrl, presentationStyle: 'popover' }),
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(
              () => reject(new Error('cap_browser_open_timeout')),
              CAP_BROWSER_OPEN_TIMEOUT_MS,
            )
          }),
        ])
        return 'opened'
      } finally {
        if (timer !== undefined) window.clearTimeout(timer)
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === 'cap_browser_open_timeout'
      ) {
        return 'timeout'
      }
      return 'failed'
    }
  }

  const next = capBrowserOpenChain.then(run, run)
  capBrowserOpenChain = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

/**
 * Capacitor: open Google OAuth in Chrome Custom Tabs via @capacitor/browser.
 * When Google redirects to https://localhost/?code=…, Android routes back into
 * the Cap WebView (androidScheme https). Falls back to in-WebView assign.
 *
 * Never call this from Pull — only from explicit Connect Google. Parallel
 * Browser.open from calendar+gmail Pull used to hang the spinner forever.
 */
async function connectViaCapBrowser(
  clientId: string,
  scopes: string,
): Promise<{
  ok: boolean
  error?: string
  pendingRedirect?: boolean
}> {
  const state = `lumina_${Math.random().toString(36).slice(2)}_${Date.now()}`
  const redirectUri = getOAuthRedirectUri()
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  sessionStorage.setItem(REDIRECT_URI_KEY, redirectUri)
  const authUrl = buildGoogleAuthUrl(clientId, scopes, redirectUri, state)

  const outcome = await openCapCustomTab(authUrl)
  if (outcome === 'opened') {
    return { ok: false, pendingRedirect: true }
  }
  if (outcome === 'timeout') {
    return { ok: false, error: 'browser_open_timeout' }
  }
  // Plugin missing / failed — fall through to in-WebView navigation.
  window.location.assign(authUrl)
  return { ok: false, pendingRedirect: true }
}

/**
 * Mobile-safe redirect OAuth via Google's auth endpoint (not GIS code client).
 * Gives exact control over redirect_uri so it matches Cloud Console entries.
 * On Capacitor, prefers Custom Tabs (@capacitor/browser) so GIS-in-WebView
 * blank pages don't block Connect Google.
 */
async function connectViaRedirect(
  clientId: string,
  scopes: string,
): Promise<{
  ok: boolean
  error?: string
  pendingRedirect?: boolean
}> {
  if (isNativeCapacitor()) {
    return connectViaCapBrowser(clientId, scopes)
  }

  const state = `lumina_${Math.random().toString(36).slice(2)}_${Date.now()}`
  const redirectUri = getOAuthRedirectUri()
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  sessionStorage.setItem(REDIRECT_URI_KEY, redirectUri)

  window.location.assign(
    buildGoogleAuthUrl(clientId, scopes, redirectUri, state),
  )
  return { ok: false, pendingRedirect: true }
}

async function connectViaPopup(
  clientId: string,
  scopes: string,
): Promise<{
  ok: boolean
  error?: string
}> {
  await loadGisScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) {
    return { ok: false, error: 'gis_unavailable' }
  }

  return new Promise((resolve) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes,
      include_granted_scopes: true,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          resolve({ ok: false, error: resp.error ?? 'auth_denied' })
          return
        }
        const granted = resp.scope || scopes
        const expiresIn = Number(resp.expires_in ?? 3600)
        writeStored({
          accessToken: resp.access_token,
          expiresAt: Date.now() + expiresIn * 1000,
          scope: granted,
        })
        if (!hasRequiredGoogleScopes(granted)) {
          resolve({
            ok: false,
            error: `missing_scopes:${missingGoogleScopes(granted).join(',')}`,
          })
          return
        }
        resolve({ ok: true })
      },
    })
    // Force consent so calendar.readonly + gmail.readonly are requested together.
    client.requestAccessToken({ prompt: 'consent' })
  })
}

/** Interactive OAuth — redirect on mobile, GIS token popup on desktop. */
export async function connectGoogle(): Promise<{
  ok: boolean
  error?: string
  demoMode?: boolean
  pendingRedirect?: boolean
  redirectUri?: string
}> {
  const config = await fetchGoogleConfig(true)
  if (!config.configured || !config.clientId) {
    return { ok: false, demoMode: true, error: 'google_not_configured' }
  }

  const scopes = config.scopes || GOOGLE_SCOPES
  const redirectUri = getOAuthRedirectUri()

  if (prefersRedirectOAuth()) {
    const result = await connectViaRedirect(config.clientId, scopes)
    return { ...result, redirectUri }
  }

  try {
    const result = await connectViaPopup(config.clientId, scopes)
    return { ...result, redirectUri }
  } catch {
    // Popup blocked / blanked — fall back to redirect.
    const result = await connectViaRedirect(config.clientId, scopes)
    return { ...result, redirectUri }
  }
}

async function silentPopupToken(clientId: string, scopes: string): Promise<string | null> {
  await loadGisScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) return null

  return new Promise((resolve) => {
    let settled = false
    const finish = (token: string | null) => {
      if (settled) return
      settled = true
      resolve(token)
    }
    // GIS may never call back if interaction is required — time out.
    const timer = window.setTimeout(() => finish(null), 3500)
    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        include_granted_scopes: true,
        callback: (resp) => {
          window.clearTimeout(timer)
          if (resp.error || !resp.access_token) {
            finish(null)
            return
          }
          writeStored({
            accessToken: resp.access_token,
            expiresAt: Date.now() + Number(resp.expires_in ?? 3600) * 1000,
            scope: resp.scope || scopes,
          })
          finish(resp.access_token)
        },
      })
      client.requestAccessToken({ prompt: '' })
    } catch {
      window.clearTimeout(timer)
      finish(null)
    }
  })
}

export type EnsureGoogleAccessOptions = {
  /**
   * When true, may open Cap Custom Tabs / GIS popup / redirect.
   * Pull / connectors must leave this false (default) so unsigned users get a
   * clear “Connect Google” message instead of an infinite spinner.
   */
  interactive?: boolean
}

/**
 * Ensure a fresh access token exists.
 * Default (Pull): memory/session token → refresh_token → optional silent GIS.
 * Never opens Cap Custom Tabs or a GIS consent UI unless `interactive: true`
 * (Connect Google button only). Phone system Google account is never enough.
 */
export async function ensureGoogleAccessToken(
  options: EnsureGoogleAccessOptions = {},
): Promise<string | null> {
  const interactive = options.interactive === true

  const existing = getGoogleAccessToken()
  if (existing) {
    if (!hasStoredRequiredScopes()) {
      if (!interactive) return null
      // Token present but missing calendar/gmail — force incremental reconnect.
      const result = await connectGoogle()
      if (!result.ok) return null
      return getGoogleAccessToken()
    }
    return existing
  }

  const refreshed = await refreshWithStoredToken()
  if (refreshed) return refreshed

  const config = await fetchGoogleConfig()
  // Silent GIS only on desktop-ish surfaces — never in Cap / mobile redirect mode.
  if (config.configured && config.clientId && !prefersRedirectOAuth()) {
    const silent = await silentPopupToken(
      config.clientId,
      config.scopes || GOOGLE_SCOPES,
    )
    if (silent) return silent
  }

  if (!interactive) return null

  const result = await connectGoogle()
  if (!result.ok) return null
  return getGoogleAccessToken()
}

export function describeGrantedScopes(): string {
  const scope = getGoogleGrantedScopes()
  if (!scope) return 'unknown'
  return parseScopeString(scope).join(' ')
}
