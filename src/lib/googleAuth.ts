import { fetchGoogleConfig } from './googleConfig'
import {
  GOOGLE_SCOPES,
  hasRequiredGoogleScopes,
  missingGoogleScopes,
  parseScopeString,
} from './googleScopes'

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

function readStored(): StoredToken | null {
  try {
    // Prefer localStorage — sessionStorage is wiped too easily on mobile Safari
    // after OAuth redirects / tab discards.
    const raw =
      localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredToken
    if (!parsed.accessToken || !parsed.expiresAt) return null
    if (Date.now() >= parsed.expiresAt - 30_000) {
      // Keep refreshToken around for silent renewal; drop only the access token.
      if (parsed.refreshToken) {
        const stale: StoredToken = {
          accessToken: '',
          expiresAt: 0,
          scope: parsed.scope,
          refreshToken: parsed.refreshToken,
        }
        writeStoredRaw(stale)
        return stale
      }
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredRaw(token: StoredToken): void {
  const raw = JSON.stringify(token)
  try {
    localStorage.setItem(TOKEN_KEY, raw)
  } catch {
    /* quota / private mode */
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, raw)
  } catch {
    /* private mode */
  }
}

function writeStored(token: StoredToken): void {
  const prev = (() => {
    try {
      const raw =
        localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
      return raw ? (JSON.parse(raw) as StoredToken) : null
    } catch {
      return null
    }
  })()
  writeStoredRaw({
    ...token,
    refreshToken: token.refreshToken ?? prev?.refreshToken,
    scope: token.scope ?? prev?.scope,
  })
}

export function clearGoogleToken(): void {
  let existing: StoredToken | null = null
  try {
    const raw =
      localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
    existing = raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    existing = null
  }
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
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
  try {
    const raw =
      localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredToken
    return typeof parsed.scope === 'string' ? parsed.scope : null
  } catch {
    return null
  }
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

  let res = await fetch('/api/google/exchange', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body,
  })
  if (res.status === 404) {
    res = await fetch('/api/google/exchange/route', {
      method: 'POST',
      credentials: 'same-origin',
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
  let refreshToken: string | undefined
  try {
    const raw =
      localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    refreshToken = (JSON.parse(raw) as StoredToken).refreshToken
  } catch {
    return null
  }
  if (!refreshToken) return null

  const body = JSON.stringify({ refreshToken })
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  let res = await fetch('/api/google/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body,
  })
  if (res.status === 404) {
    res = await fetch('/api/google/refresh/route', {
      method: 'POST',
      credentials: 'same-origin',
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

    if (expectedState && state && expectedState !== state) {
      sessionStorage.setItem(AUTH_FLASH_KEY, 'state_mismatch')
      return
    }

    const result = await exchangeCode(code!, redirectUri)
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

/**
 * Mobile-safe redirect OAuth via Google's auth endpoint (not GIS code client).
 * Gives exact control over redirect_uri so it matches Cloud Console entries.
 */
async function connectViaRedirect(
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

  window.location.assign(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
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

/**
 * Ensure a fresh access token exists.
 * Tries: valid localStorage token → refresh_token exchange → silent GIS → interactive.
 */
export async function ensureGoogleAccessToken(): Promise<string | null> {
  const existing = getGoogleAccessToken()
  if (existing) {
    if (!hasStoredRequiredScopes()) {
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
  if (config.configured && config.clientId && !prefersRedirectOAuth()) {
    const silent = await silentPopupToken(
      config.clientId,
      config.scopes || GOOGLE_SCOPES,
    )
    if (silent) return silent
  }

  const result = await connectGoogle()
  if (!result.ok) return null
  return getGoogleAccessToken()
}

export function describeGrantedScopes(): string {
  const scope = getGoogleGrantedScopes()
  if (!scope) return 'unknown'
  return parseScopeString(scope).join(' ')
}
