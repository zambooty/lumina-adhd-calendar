import { GOOGLE_SCOPES } from './googleScopes'

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
      const res = await fetch('/api/google/status', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
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
