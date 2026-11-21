import { fetchGoogleConfig } from './googleConfig'
import { GOOGLE_SCOPES } from './googleScopes'

const TOKEN_KEY = 'lumina_google_access_v1'

type StoredToken = {
  accessToken: string
  expiresAt: number
  scope?: string
}

type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
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
  revoke: (token: string, done?: () => void) => void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GisOauth2 } }
  }
}

let scriptPromise: Promise<void> | null = null

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
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredToken
    if (!parsed.accessToken || !parsed.expiresAt) return null
    if (Date.now() >= parsed.expiresAt - 30_000) {
      sessionStorage.removeItem(TOKEN_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStored(token: StoredToken): void {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}

export function clearGoogleToken(): void {
  const existing = readStored()
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

/** Interactive OAuth via Google Identity Services token client. */
export async function connectGoogle(): Promise<{
  ok: boolean
  error?: string
  demoMode?: boolean
}> {
  const config = await fetchGoogleConfig(true)
  if (!config.configured || !config.clientId) {
    return { ok: false, demoMode: true, error: 'google_not_configured' }
  }

  await loadGisScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) {
    return { ok: false, error: 'gis_unavailable' }
  }

  return new Promise((resolve) => {
    const client = oauth2.initTokenClient({
      client_id: config.clientId!,
      scope: config.scopes || GOOGLE_SCOPES,
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

/** Ensure a fresh access token exists; prompts if needed. */
export async function ensureGoogleAccessToken(): Promise<string | null> {
  const existing = getGoogleAccessToken()
  if (existing) return existing
  const result = await connectGoogle()
  if (!result.ok) return null
  return getGoogleAccessToken()
}
