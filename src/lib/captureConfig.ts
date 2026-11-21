/**
 * Client-side capture provider status (Twilio / Whisper / IMAP live).
 * Mirrors /api/capture/status — never exposes secret values.
 * Caches a short-lived captureToken for POST /api/capture/transcribe.
 */
import type { CaptureProviderStatus } from '../connectors/types'

const FALLBACK: CaptureProviderStatus = {
  twilioConfigured: false,
  whisperConfigured: false,
  imapLiveConfigured: false,
}

type CaptureConfigCache = CaptureProviderStatus & {
  captureToken?: string | null
  captureTokenExpiresAt?: number
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
      const data = (await res.json()) as Partial<CaptureConfigCache> & {
        captureTokenTtlSec?: number
      }
      const ttlSec =
        typeof data.captureTokenTtlSec === 'number' && data.captureTokenTtlSec > 0
          ? data.captureTokenTtlSec
          : 300
      cached = {
        twilioConfigured: Boolean(data.twilioConfigured),
        whisperConfigured: Boolean(data.whisperConfigured),
        imapLiveConfigured: Boolean(data.imapLiveConfigured),
        captureToken:
          typeof data.captureToken === 'string' ? data.captureToken : null,
        captureTokenExpiresAt: Date.now() + ttlSec * 1000,
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

/**
 * Returns a spendable capture token, refreshing status when missing/expired.
 * Tokens are one-shot server-side — call once per transcribe attempt.
 */
export async function takeCaptureToken(): Promise<string | null> {
  const fresh =
    !cached?.captureToken ||
    !cached.captureTokenExpiresAt ||
    Date.now() >= cached.captureTokenExpiresAt - 5_000
  if (fresh) {
    await fetchCaptureConfig(true)
  }
  const token = cached?.captureToken ?? null
  // Clear locally so we don't reuse a one-shot token after a successful spend.
  if (cached) {
    cached.captureToken = null
    cached.captureTokenExpiresAt = 0
  }
  return token
}
