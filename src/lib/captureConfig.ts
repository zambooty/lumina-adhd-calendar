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

let cached: CaptureProviderStatus | null = null
let inflight: Promise<CaptureProviderStatus> | null = null

export async function fetchCaptureConfig(
  force = false,
): Promise<CaptureProviderStatus> {
  if (!force && cached) return cached
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
        cached = FALLBACK
        return FALLBACK
      }
      const data = (await res.json()) as Partial<CaptureProviderStatus>
      cached = {
        twilioConfigured: Boolean(data.twilioConfigured),
        whisperConfigured: Boolean(data.whisperConfigured),
        imapLiveConfigured: Boolean(data.imapLiveConfigured),
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

export function getCachedCaptureConfig(): CaptureProviderStatus | null {
  return cached
}
