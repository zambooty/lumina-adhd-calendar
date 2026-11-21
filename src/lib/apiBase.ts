/**
 * Resolve `/api/*` URLs for web + Capacitor.
 *
 * On the published host and local Vite, relative `/api/...` works (same origin).
 * Capacitor packages `dist/` at `https://localhost` — relative fetches have no
 * backend. Point those at the published app so Google/capture routes stay live
 * while the WebView origin remains `https://localhost` (one OAuth Web client).
 */
import { PUBLISHED_APP_ORIGIN } from './publishedOrigin'
import { isNativeCapacitor } from './platform'

/** Override via Vite env if ever needed; default = published. */
export function getLiveApiOrigin(): string {
  try {
    const fromEnv = import.meta.env.VITE_LUMINA_API_ORIGIN
    if (typeof fromEnv === 'string' && fromEnv.trim()) {
      return fromEnv.trim().replace(/\/$/, '')
    }
  } catch {
    /* non-Vite */
  }
  return PUBLISHED_APP_ORIGIN
}

/**
 * True when Cap WebView origin is local (bundled assets) and API must be absolute.
 * False when Cap loads remote `server.url` (same-origin published host).
 */
export function needsAbsoluteApiBase(): boolean {
  if (typeof window === 'undefined') return false
  if (!isNativeCapacitor()) return false
  const origin = window.location.origin
  return (
    origin === 'https://localhost' ||
    origin === 'http://localhost' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost'
  )
}

/** Absolute or relative API path. Always starts with `/api/` or full URL. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!needsAbsoluteApiBase()) return normalized
  return `${getLiveApiOrigin()}${normalized}`
}

/**
 * Fetch options for `/api/*`. Cross-origin Cap calls omit cookies
 * (Origin still sent for the server allowlist); same-origin keeps credentials.
 */
export function apiFetchInit(init: RequestInit = {}): RequestInit {
  const cross = needsAbsoluteApiBase()
  return {
    ...init,
    credentials: cross ? 'omit' : (init.credentials ?? 'same-origin'),
  }
}

/** Convenience: apiUrl + apiFetchInit. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), apiFetchInit(init))
}
