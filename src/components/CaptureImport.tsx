/**
 * Paste / upload capture for Notes, IMAP email, SMS, Voicemail.
 * Self-contained block — nest inside SourceInbox (or a CollapsiblePanel body).
 * Does not own page layout / pet placement.
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ingestCaptureText, transcribeVoicemailAudio } from '../connectors'
import { fetchCaptureConfig } from '../lib/captureConfig'
import type { CaptureProviderStatus } from '../connectors/types'
import {
  IMAP_PROVIDER_PRESETS,
  loadImapPrefs,
  saveImapPrefs,
  setImapSessionPassword,
} from '../lib/imapPrefs'
import type { ImapAccountPrefs } from '../connectors/types'

type CaptureTab = 'notes' | 'imap' | 'sms' | 'voicemail'

type Props = {
  /** Called after a successful ingest so parent can Pull / flash toast. */
  onImported: (info: { added: number; tab: CaptureTab }) => void
}

const TABS: { id: CaptureTab; label: string; accent: string }[] = [
  { id: 'notes', label: 'Notes', accent: '#c8ff4d' },
  { id: 'imap', label: 'IMAP email', accent: '#4db8ff' },
  { id: 'sms', label: 'SMS', accent: '#ffb020' },
  { id: 'voicemail', label: 'Voicemail', accent: '#ff7ad9' },
]

const PLACEHOLDERS: Record<CaptureTab, string> = {
  notes:
    'Paste a sticky / brain dump…\ne.g. call insurance Tue 10:30 about claim #4421',
  imap:
    'Paste an Outlook / Yahoo / other email body…\nSubject: Appointment confirmed\nYour cleaning is Thursday at 9:15 AM…',
  sms: 'Paste a text thread…\nSam: gym Thursday 7am? I’ll save you a rack.',
  voicemail:
    'Paste a voicemail transcript…\nHi, this is the dentist confirming your visit Friday at 2pm.',
}

export function CaptureImport({ onImported }: Props) {
  const [tab, setTab] = useState<CaptureTab>('notes')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [providers, setProviders] = useState<CaptureProviderStatus | null>(null)
  const [imap, setImap] = useState<ImapAccountPrefs>(() => loadImapPrefs())
  const [imapPass, setImapPass] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void fetchCaptureConfig().then((cfg) => {
      if (!cancelled) setProviders(cfg)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const providerHint = (() => {
    if (!providers) return null
    if (tab === 'sms' && !providers.twilioConfigured) {
      return 'Twilio unbound — paste-only for now.'
    }
    if (tab === 'sms' && providers.twilioConfigured) {
      return 'Twilio ready — webhook at /api/capture/twilio-sms (paste still works).'
    }
    if (tab === 'voicemail' && !providers.whisperConfigured) {
      return 'Whisper unbound — paste a transcript (audio upload needs a key).'
    }
    if (tab === 'voicemail' && providers.whisperConfigured) {
      return 'Speech-to-text ready after Connect Google — or paste a transcript.'
    }
    if (tab === 'imap' && !providers.imapLiveConfigured) {
      return 'IMAP live fetch unbound — paste email or save prefs for later.'
    }
    return null
  })()

  const handleIngest = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const { added } = await ingestCaptureText(tab, text)
      if (added === 0) {
        setStatus(
          'No appointment-like times found. Try adding a day + time (e.g. Friday 2pm).',
        )
      } else {
        setStatus(`Queued ${added} — tap Pull from sources to land in inbox.`)
        setText('')
        onImported({ added, tab })
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleFileText = async (file: File) => {
    const raw = await file.text()
    setText((prev) => (prev ? `${prev}\n\n${raw}` : raw))
    setStatus(`Loaded ${file.name} — review, then Import.`)
  }

  const handleAudio = async (file: File) => {
    setBusy(true)
    setStatus(null)
    try {
      const result = await transcribeVoicemailAudio(file)
      if (!result.ok) {
        setStatus(result.error ?? 'Transcription unavailable.')
        return
      }
      if (result.transcript) setText(result.transcript)
      setStatus(
        result.added > 0
          ? `Transcribed · queued ${result.added} — Pull from sources.`
          : 'Transcribed — no appointment times found; edit text and Import.',
      )
      if (result.added > 0) onImported({ added: result.added, tab: 'voicemail' })
    } finally {
      setBusy(false)
    }
  }

  const saveImap = () => {
    saveImapPrefs(imap)
    setImapSessionPassword(imapPass)
    setStatus(
      imapPass
        ? 'IMAP prefs + session password saved (password stays in this tab only).'
        : 'IMAP prefs saved (host/user only).',
    )
  }

  const applyProvider = (provider: ImapAccountPrefs['provider']) => {
    const preset = IMAP_PROVIDER_PRESETS[provider]
    setImap((p) => ({
      ...p,
      provider,
      host: preset.host || p.host,
      port: preset.port,
    }))
  }

  return (
    <motion.div
      className="capture-import"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <p className="capture-import-label">Capture import</p>
      <p className="capture-import-hint">
        Notes · IMAP/other email · SMS · Voicemail — paste or upload, then Pull.
      </p>

      <div className="capture-tabs" role="tablist" aria-label="Capture source">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`capture-tab${tab === t.id ? ' active' : ''}`}
            style={{
              borderColor: tab === t.id ? `${t.accent}88` : undefined,
              color: tab === t.id ? t.accent : undefined,
            }}
            onClick={() => {
              setTab(t.id)
              setStatus(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {providerHint && (
        <p className="capture-provider-hint" role="status">
          {providerHint}
        </p>
      )}

      {tab === 'imap' && (
        <div className="imap-prefs">
          <div className="imap-prefs-row">
            <label className="imap-field">
              <span>Provider</span>
              <select
                value={imap.provider}
                onChange={(e) =>
                  applyProvider(e.target.value as ImapAccountPrefs['provider'])
                }
              >
                {(
                  Object.keys(IMAP_PROVIDER_PRESETS) as ImapAccountPrefs['provider'][]
                ).map((key) => (
                  <option key={key} value={key}>
                    {IMAP_PROVIDER_PRESETS[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="imap-field">
              <span>Host</span>
              <input
                value={imap.host}
                onChange={(e) => setImap((p) => ({ ...p, host: e.target.value }))}
                placeholder="imap.example.com"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="imap-prefs-row">
            <label className="imap-field">
              <span>User</span>
              <input
                value={imap.user}
                onChange={(e) => setImap((p) => ({ ...p, user: e.target.value }))}
                placeholder="you@outlook.com"
                autoComplete="username"
              />
            </label>
            <label className="imap-field">
              <span>App password (session)</span>
              <input
                type="password"
                value={imapPass}
                onChange={(e) => setImapPass(e.target.value)}
                placeholder="optional · this tab only"
                autoComplete="current-password"
              />
            </label>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={saveImap}
          >
            Save IMAP prefs
          </button>
        </div>
      )}

      <textarea
        className="capture-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDERS[tab]}
        rows={5}
        aria-label={`${tab} import text`}
      />

      <div className="capture-actions">
        <button
          type="button"
          className="btn btn-coral btn-sm"
          disabled={busy || !text.trim()}
          onClick={() => void handleIngest()}
        >
          {busy ? 'Importing…' : 'Import to queue'}
        </button>

        {(tab === 'notes' || tab === 'imap' || tab === 'sms') && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={
                tab === 'imap'
                  ? '.txt,.md,.eml,text/plain,message/rfc822'
                  : '.txt,.md,text/plain'
              }
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFileText(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              Upload file
            </button>
          </>
        )}

        {tab === 'voicemail' && (
          <>
            <input
              ref={audioRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleAudio(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => audioRef.current?.click()}
              disabled={busy}
            >
              Upload audio
            </button>
          </>
        )}
      </div>

      {status && (
        <p
          className={`capture-status ${
            /fail|unbound|unavailable|No appointment/i.test(status)
              ? 'capture-status-warn'
              : 'capture-status-ok'
          }`}
          role="status"
        >
          {status}
        </p>
      )}
    </motion.div>
  )
}
