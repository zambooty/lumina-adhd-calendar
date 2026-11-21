import { fetchGoogleConfig } from './googleConfig'
import { GOOGLE_SCOPES } from './googleScopes'

const TOKEN_KEY = 'lumina_google_access_v1'
const OAUTH_STATE_KEY = 'lumina_google_oauth_state_v1'

type StoredToken = {
  accessToken: string
  expiresAt: number
  scope?: string
}

type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

type CodeClient = {
  requestCode: () => void
}

type GisOauth2 = {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (resp: {
      access_token?: string
      expires_in?: number
      scope?: string
      error?: string
    }) => void
  }) => TokenClient
  initCodeClient: (config: {
    client_id: string
    scope: string
    ux_mode?: 'popup' | 'redirect'
    redirect_uri?: string
    state?: string
    callback?: (resp: {
      code?: string
      scope?: string
      error?: string
      state?: string
    }) => void
  }) => CodeClient
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
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStored(token: StoredToken): void {
  const raw = JSON.stringify(token)
  localStorage.setItem(TOKEN_KEY, raw)
  try {
    sessionStorage.setItem(TOKEN_KEY, raw)
  } catch {
    /* private mode */
  }
}

export function clearGoogleToken(): void {
  const existing = readStored()
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
  return readStored()?.accessToken ?? null
}

export function isGoogleConnected(): boolean {
  return Boolean(getGoogleAccessToken())
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

function redirectUri(): string {
  return `${window.location.origin}/`
}

function clearOAuthParamsFromUrl(): void {
  const url = new URL(window.location.href)
  ;['code', 'scope', 'authuser', 'prompt', 'state', 'error', 'error_description'].forEach(
    (k) => url.searchParams.delete(k),
  )
  const cleaned = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, document.title, cleaned || '/')
}

async function exchangeCode(code: string): Promise<{
  ok: boolean
  error?: string
}> {
  const res = await fetch('/api/google/exchange', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirectUri: redirectUri(),
    }),
  })
  if (res.status === 404) {
    // Host may map to /route suffix
    const retry = await fetch('/api/google/exchange/route', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirectUri: redirectUri(),
      }),
    })
    if (!retry.ok) {
      const payload = (await retry.json().catch(() => ({}))) as {
        error?: string
      }
      return { ok: false, error: payload.error ?? `exchange_${retry.status}` }
    }
    const payload = (await retry.json()) as {
      accessToken?: string
      expiresIn?: number
      scope?: string
    }
    if (!payload.accessToken) {
      return { ok: false, error: 'exchange_no_token' }
    }
    writeStored({
      accessToken: payload.accessToken,
      expiresAt: Date.now() + Number(payload.expiresIn ?? 3600) * 1000,
      scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    })
    return { ok: true }
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: payload.error ?? `exchange_${res.status}` }
  }
  const payload = (await res.json()) as {
    accessToken?: string
    expiresIn?: number
    scope?: string
  }
  if (!payload.accessToken) {
    return { ok: false, error: 'exchange_no_token' }
  }
  writeStored({
    accessToken: payload.accessToken,
    expiresAt: Date.now() + Number(payload.expiresIn ?? 3600) * 1000,
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
  })
  return { ok: true }
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
    clearOAuthParamsFromUrl()
    sessionStorage.removeItem(OAUTH_STATE_KEY)

    if (err) {
      sessionStorage.setItem(
        'lumina_google_auth_flash',
        err === 'access_denied' ? 'auth_denied' : err,
      )
      return
    }

    if (expectedState && state && expectedState !== state) {
      sessionStorage.setItem('lumina_google_auth_flash', 'state_mismatch')
      return
    }

    const result = await exchangeCode(code!)
    sessionStorage.setItem(
      'lumina_google_auth_flash',
      result.ok ? 'connected' : result.error ?? 'exchange_failed',
    )
  })()

  try {
    await hydratePromise
    const flash = sessionStorage.getItem('lumina_google_auth_flash')
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
  const flash = sessionStorage.getItem('lumina_google_auth_flash')
  if (flash) sessionStorage.removeItem('lumina_google_auth_flash')
  return flash
}

async function connectViaRedirect(clientId: string, scopes: string): Promise<{
  ok: boolean
  error?: string
  pendingRedirect?: boolean
}> {
  await loadGisScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2?.initCodeClient) {
    return { ok: false, error: 'gis_unavailable' }
  }

  const state = `lumina_${Math.random().toString(36).slice(2)}_${Date.now()}`
  sessionStorage.setItem(OAUTH_STATE_KEY, state)

  try {
    const client = oauth2.initCodeClient({
      client_id: clientId,
      scope: scopes,
      ux_mode: 'redirect',
      redirect_uri: redirectUri(),
      state,
    })
    // requestCode navigates away; return pending so UI can show a hint.
    client.requestCode()
    return { ok: false, pendingRedirect: true }
  } catch (err) {
    sessionStorage.removeItem(OAUTH_STATE_KEY)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'redirect_failed',
    }
  }
}

async function connectViaPopup(clientId: string, scopes: string): Promise<{
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
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          resolve({ ok: false, error: resp.error ?? 'auth_denied' })
          return
        }
        const expiresIn = Number(resp.expires_in ?? 3600)
        writeStored({
          accessToken: resp.access_token,
          expiresAt: Date.now() + expiresIn * 1000,
          scope: resp.scope,
        })
        resolve({ ok: true })
      },
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

/** Interactive OAuth — redirect on mobile, GIS token popup on desktop. */
export async function connectGoogle(): Promise<{
  ok: boolean
  error?: string
  demoMode?: boolean
  pendingRedirect?: boolean
}> {
  const config = await fetchGoogleConfig(true)
  if (!config.configured || !config.clientId) {
    return { ok: false, demoMode: true, error: 'google_not_configured' }
  }

  const scopes = config.scopes || GOOGLE_SCOPES

  if (prefersRedirectOAuth()) {
    return connectViaRedirect(config.clientId, scopes)
  }

  try {
    return await connectViaPopup(config.clientId, scopes)
  } catch {
    // Popup blocked / blanked — fall back to redirect.
    return connectViaRedirect(config.clientId, scopes)
  }
}

/** Ensure a fresh access token exists; prompts if needed. */
export async function ensureGoogleAccessToken(): Promise<string | null> {
  const existing = getGoogleAccessToken()
  if (existing) return existing
  const result = await connectGoogle()
  if (!result.ok) return null
  return getGoogleAccessToken()
}
