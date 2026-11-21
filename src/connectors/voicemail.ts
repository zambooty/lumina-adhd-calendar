/**
 * Voicemail connector — paste transcript or upload audio.
 * Whisper/OpenAI STT when WHISPER_API_KEY or OPENAI_API_KEY is bound;
 * otherwise honest stub + paste path.
 */
import type { ConnectorPullResult, SourceConnector } from './types'
import { SOURCE_META } from './demoData'
import { textToCandidates } from '../lib/textToCandidates'
import { enqueueImports, takeImports } from '../lib/importQueue'
import { fetchCaptureConfig } from '../lib/captureConfig'
import { ensureGoogleAccessToken, isGoogleConnected } from '../lib/googleAuth'
import { apiFetch } from '../lib/apiBase'

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
        emptyHint: isGoogleConnected()
          ? 'Speech-to-text is ready — upload a voicemail audio file, or paste a transcript.'
          : 'Speech-to-text needs Connect Google — or paste a transcript.',
      }
    }

    return {
      candidates: [],
      emptyHint:
        'No voicemail imports yet — paste a transcript, or upload audio (STT needs a Whisper key + Google).',
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
        'Speech-to-text is not enabled — paste a transcript, or bind a Whisper key plus CAPTURE_TRANSCRIBE_ALLOWED_EMAILS.',
    }
  }

  // Never open Cap Custom Tabs from voice import — user must Connect Google first.
  const googleAccessToken = await ensureGoogleAccessToken({
    interactive: false,
  })
  if (!googleAccessToken) {
    return {
      ok: false,
      added: 0,
      error:
        'Connect Google to use speech-to-text, or paste a transcript instead.',
    }
  }

  const body = new FormData()
  body.append('file', file)
  body.append('filename', file.name)

  try {
    const res = await apiFetch('/api/capture/transcribe', {
      method: 'POST',
      body,
      headers: {
        authorization: `Bearer ${googleAccessToken}`,
      },
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
      }
      const code = payload.error ?? `transcribe_${res.status}`
      if (
        code === 'google_auth_required' ||
        code === 'google_auth_invalid' ||
        code === 'google_auth_expired' ||
        code === 'google_auth_audience'
      ) {
        return {
          ok: false,
          added: 0,
          error:
            'Google session expired — Connect Google again, or paste a transcript.',
        }
      }
      return {
        ok: false,
        added: 0,
        error: code,
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
