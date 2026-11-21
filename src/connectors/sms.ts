/**
 * SMS connector — paste-import MVP; Twilio webhook when secrets are bound.
 */
import type { ConnectorPullResult, SourceConnector } from './types'
import { delay, demoTextsCandidates, SOURCE_META } from './demoData'
import { textToCandidates } from '../lib/textToCandidates'
import { enqueueImports, takeImports } from '../lib/importQueue'
import { fetchGoogleConfig } from '../lib/googleConfig'
import { getGoogleAccessToken } from '../lib/googleAuth'
import { fetchCaptureConfig } from '../lib/captureConfig'
import { isAndroidNative } from '../lib/platform'

async function isGoogleLive(): Promise<boolean> {
  const config = await fetchGoogleConfig()
  return (
    config.configured && !config.demoMode && Boolean(getGoogleAccessToken())
  )
}

export const smsConnector: SourceConnector = {
  id: 'texts',
  label: SOURCE_META.texts.label,
  accent: SOURCE_META.texts.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    const imported = takeImports('texts')
    if (imported.length) {
      return { candidates: imported }
    }

    const capture = await fetchCaptureConfig()
    if (capture.twilioConfigured) {
      // Webhook stores into the same import queue when messages arrive.
      return {
        candidates: [],
        emptyHint:
          'Twilio is configured — waiting for inbound SMS, or paste a thread now.',
      }
    }

    await delay(140)
    if (await isGoogleLive()) {
      return {
        candidates: [],
        emptyHint: isAndroidNative()
          ? 'No SMS candidates this pull — Allow SMS on the system prompt, or paste/share a thread.'
          : 'No SMS imports yet — paste a text thread, or bind Twilio secrets for webhooks.',
      }
    }
    // Cap Android: never inject demo SMS — Pull should reflect real inbox / paste.
    if (isAndroidNative()) {
      return {
        candidates: [],
        emptyHint:
          'No SMS candidates yet — Allow SMS when Pull asks, or paste/share a thread.',
      }
    }
    return { candidates: demoTextsCandidates(), usedDemo: true }
  },
  async ingestText(text, meta) {
    const candidates = textToCandidates(text, {
      source: 'texts',
      sourceLabel: meta?.label ?? 'SMS · Import',
      fallbackTitle: 'Text appointment',
    })
    enqueueImports(candidates)
    return { added: candidates.length, candidates }
  },
}
