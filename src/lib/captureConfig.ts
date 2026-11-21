/**
 * Client-side capture provider status (Twilio / Whisper / IMAP live).
 * Mirrors /api/capture/status — never exposes secret values.
 */
import type { CaptureProviderStatus } from '../connectors/types'

const FALLBACK: CaptureProviderStatus = {
  twilioConfigured: false,
  whisperConfigured: false,
  imapLiveConfigured: false,
}

type CaptureConfigCache = CaptureProviderStatus & {
  sttRequiresGoogle?: boolean
  googleConfigured?: boolean
}

let cached: CaptureConfigCache | null = null
let inflight: Promise<CaptureProviderStatus> | null = null

function asStatus(cfg: CaptureConfigCache): CaptureProviderStatus {
  return {
    twilioConfigured: cfg.twilioConfigured,
    whisperConfigured: cfg.whisperConfigured,
    imapLiveConfigured: cfg.imapLiveConfigured,
  }
}

export async function fetchCaptureConfig(
  force = false,
): Promise<CaptureProviderStatus> {
  if (!force && cached) return asStatus(cached)
  if (!force && inflight) return inflight

  inflight = (async () => {
    try {
      let res = await fetch('/api/capture/status', {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (res.status === 404) {
        res = await fetch('/api/capture/status/route', {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
      }
      if (!res.ok) {
        cached = { ...FALLBACK }
        return FALLBACK
      }
      const data = (await res.json()) as Partial<CaptureConfigCache>
      cached = {
        twilioConfigured: Boolean(data.twilioConfigured),
        whisperConfigured: Boolean(data.whisperConfigured),
        imapLiveConfigured: Boolean(data.imapLiveConfigured),
        sttRequiresGoogle: data.sttRequiresGoogle !== false,
        googleConfigured: Boolean(data.googleConfigured),
      }
      return asStatus(cached)
    } catch {
      cached = { ...FALLBACK }
      return FALLBACK
    } finally {
      inflight = null
    }
  })()

  return inflight
}

export function getCachedCaptureConfig(): CaptureProviderStatus | null {
  return cached ? asStatus(cached) : null
}

/** True when speech-to-text needs a Connected Google session (default yes). */
export function sttRequiresGoogle(): boolean {
  return cached?.sttRequiresGoogle !== false
}
