/**
 * Voicemail connector — paste transcript or upload audio.
 * Whisper/OpenAI STT when WHISPER_API_KEY or OPENAI_API_KEY is bound;
 * otherwise honest stub + paste path.
 */
import type { ConnectorPullResult, SourceConnector } from './types'
import { SOURCE_META } from './demoData'
import { textToCandidates } from '../lib/textToCandidates'
import { enqueueImports, takeImports } from '../lib/importQueue'
import { fetchCaptureConfig, takeCaptureToken } from '../lib/captureConfig'

export const voicemailConnector: SourceConnector = {
  id: 'voicemail',
  label: SOURCE_META.voicemail.label,
  accent: SOURCE_META.voicemail.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    const imported = takeImports('voicemail')
    if (imported.length) {
      return { candidates: imported }
    }

    const capture = await fetchCaptureConfig()
    if (capture.whisperConfigured) {
      return {
        candidates: [],
        emptyHint:
          'Speech-to-text is ready — upload a voicemail audio file, or paste a transcript.',
      }
    }

    return {
      candidates: [],
      emptyHint:
        'No voicemail imports yet — paste a transcript, or upload audio (STT needs a Whisper key).',
    }
  },
  async ingestText(text, meta) {
    const candidates = textToCandidates(text, {
      source: 'voicemail',
      sourceLabel: meta?.label ?? 'Voicemail · Transcript',
      fallbackTitle: 'Voicemail appointment',
    })
    enqueueImports(candidates)
    return { added: candidates.length, candidates }
  },
}

/**
 * Upload audio → optional Whisper → ingest transcript as voicemail candidates.
 */
export async function transcribeVoicemailAudio(
  file: File,
): Promise<{
  ok: boolean
  transcript?: string
  added: number
  error?: string
  usedStub?: boolean
}> {
  const capture = await fetchCaptureConfig()
  if (!capture.whisperConfigured) {
    return {
      ok: false,
      added: 0,
      usedStub: true,
      error:
        'No Whisper / OpenAI key bound — paste a transcript instead, or bind WHISPER_API_KEY / OPENAI_API_KEY.',
    }
  }

  const captureToken = await takeCaptureToken()
  if (!captureToken) {
    return {
      ok: false,
      added: 0,
      error:
        'Could not mint a capture token — refresh the page and retry, or paste a transcript.',
    }
  }

  const body = new FormData()
  body.append('file', file)
  body.append('filename', file.name)

  try {
    const res = await fetch('/api/capture/transcribe', {
      method: 'POST',
      body,
      credentials: 'same-origin',
      headers: {
        'x-lumina-capture-token': captureToken,
      },
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      return {
        ok: false,
        added: 0,
        error: payload.error ?? `transcribe_${res.status}`,
      }
    }
    const payload = (await res.json()) as { transcript?: string }
    const transcript = (payload.transcript ?? '').trim()
    if (!transcript) {
      return { ok: false, added: 0, error: 'Empty transcript from STT.' }
    }
    const { added } = await voicemailConnector.ingestText!(transcript, {
      label: `Voicemail · ${file.name}`,
    })
    return { ok: true, transcript, added }
  } catch (err) {
    return {
      ok: false,
      added: 0,
      error: err instanceof Error ? err.message : 'transcribe_failed',
    }
  }
}
