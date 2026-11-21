import { GOOGLE_SCOPES } from './googleScopes'
import { apiFetch } from './apiBase'

export type GoogleRuntimeConfig = {
  configured: boolean
  demoMode: boolean
  clientId: string | null
  hasClientSecret: boolean
  scopes: string
}

const FALLBACK: GoogleRuntimeConfig = {
  configured: false,
  demoMode: true,
  clientId: null,
  hasClientSecret: false,
  scopes: GOOGLE_SCOPES,
}

let cached: GoogleRuntimeConfig | null = null
let inflight: Promise<GoogleRuntimeConfig> | null = null

/** Fetch server Google status. Falls back to demo when the API is missing or secrets unset. */
export async function fetchGoogleConfig(
  force = false,
): Promise<GoogleRuntimeConfig> {
  if (!force && cached) return cached
  if (!force && inflight) return inflight

  inflight = (async () => {
    try {
      // Prefer canonical path; fall back to host file-mapped `/route` URL if needed.
      // Cap Android uses absolute published API base when WebView is https://localhost.
      let res = await apiFetch('/api/google/status', {
        headers: { accept: 'application/json' },
      })
      if (res.status === 404) {
        res = await apiFetch('/api/google/status/route', {
          headers: { accept: 'application/json' },
        })
      }
      if (!res.ok) {
        cached = FALLBACK
        return FALLBACK
      }
      const data = (await res.json()) as Partial<GoogleRuntimeConfig>
      const clientId = data.clientId ?? null
      const configured = Boolean(data.configured && clientId)
      cached = {
        configured,
        demoMode: !configured,
        clientId,
        hasClientSecret: Boolean(data.hasClientSecret),
        scopes: typeof data.scopes === 'string' ? data.scopes : GOOGLE_SCOPES,
      }
      return cached
    } catch {
      cached = FALLBACK
      return FALLBACK
    } finally {
      inflight = null
    }
  })()

  return inflight
}

export function getCachedGoogleConfig(): GoogleRuntimeConfig | null {
  return cached
}
