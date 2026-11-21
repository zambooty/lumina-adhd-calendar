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
        emptyHint:
          'No SMS imports yet — paste a text thread, or bind Twilio secrets for webhooks.',
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
