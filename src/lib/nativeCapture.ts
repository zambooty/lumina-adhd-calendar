/**
 * Capacitor NativeCapture bridge — SMS inbox + share-target ingest.
 * Web: all methods return honest unavailable (paste/upload still works).
 */
import { registerPlugin } from '@capacitor/core'
import { isAndroidNative, isNativeCapacitor } from './platform'
import { notesConnector } from '../connectors/notes'
import { imapEmailConnector } from '../connectors/imapEmail'
import { smsConnector } from '../connectors/sms'
import {
  voicemailConnector,
  transcribeVoicemailAudio,
} from '../connectors/voicemail'

async function ingestCaptureText(
  kind: 'notes' | 'imap' | 'sms' | 'voicemail',
  text: string,
): Promise<{ added: number }> {
  switch (kind) {
    case 'notes':
      return notesConnector.ingestText!(text)
    case 'imap':
      return imapEmailConnector.ingestText!(text)
    case 'sms':
      return smsConnector.ingestText!(text)
    case 'voicemail':
      return voicemailConnector.ingestText!(text)
  }
}

export type NativeSmsMessage = {
  address: string
  body: string
  date: number
  type: number
}

export type NativeCapturePlugin = {
  getCapabilities(): Promise<{
    platform: string
    smsReadable: boolean
    shareTarget: boolean
    voicemailOem: boolean
    playPolicyNote: string
  }>
  checkSmsPermission(): Promise<{ sms: string }>
  requestSmsPermission(): Promise<{ sms: string }>
  readRecentSms(options?: {
    max?: number
    days?: number
  }): Promise<{
    ok: boolean
    error?: string
    hint?: string
    messages: NativeSmsMessage[]
    count?: number
  }>
  consumeSharedPayload(): Promise<{
    ok: boolean
    hasPayload: boolean
    text?: string
    mime?: string
    audioBase64?: string
    audioName?: string
    audioMime?: string
  }>
  getVoicemailStatus(): Promise<{
    ok: boolean
    oemAvailable: boolean
    hint: string
  }>
}

const NativeCapture = registerPlugin<NativeCapturePlugin>('NativeCapture')

export function nativeCaptureAvailable(): boolean {
  return isAndroidNative()
}

/** Heuristic: message looks appointment-like enough to ingest. */
export function looksLikeAppointment(text: string): boolean {
  const t = text.toLowerCase()
  if (t.length < 12) return false
  return (
    /\b(appointment|appt|schedule[d]?|meeting|remind|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(:\d{2})?\s*(am|pm)|at\s+\d{1,2})\b/i.test(
      t,
    ) || /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(t)
  )
}

export type NativePullResult = {
  smsAdded: number
  shareAdded: number
  voicemailAdded: number
  errors: string[]
  hints: string[]
}

/**
 * Cap-only: request SMS if needed, read recent inbox, ingest appointment-like
 * threads; also drain any pending share-target payload into the import queue.
 */
export async function collectNativePullCandidates(): Promise<NativePullResult> {
  const result: NativePullResult = {
    smsAdded: 0,
    shareAdded: 0,
    voicemailAdded: 0,
    errors: [],
    hints: [],
  }

  if (!isNativeCapacitor() || !isAndroidNative()) {
    return result
  }

  // Share target first (user may have shared into LUMINA then tapped Pull).
  try {
    const shared = await NativeCapture.consumeSharedPayload()
    if (shared.hasPayload) {
      if (shared.text?.trim()) {
        const lower = shared.text.toLowerCase()
        const kind: 'notes' | 'imap' | 'sms' | 'voicemail' =
          /\b(from:|subject:|mime-version:)/i.test(shared.text)
            ? 'imap'
            : looksLikeAppointment(shared.text) &&
                /\b(text message|sms|txt from)\b/i.test(lower)
              ? 'sms'
              : 'notes'
        const { added } = await ingestCaptureText(kind, shared.text)
        result.shareAdded += added
      }
      if (shared.audioBase64) {
        try {
          const bin = Uint8Array.from(atob(shared.audioBase64), (c) =>
            c.charCodeAt(0),
          )
          const blob = new Blob([bin], {
            type: shared.audioMime || 'audio/mpeg',
          })
          const file = new File(
            [blob],
            shared.audioName || 'shared-voicemail.m4a',
            { type: shared.audioMime || 'audio/mpeg' },
          )
          const tr = await transcribeVoicemailAudio(file)
          if (tr.ok) {
            result.voicemailAdded += tr.added
          } else if (tr.error) {
            result.errors.push(tr.error)
            // Fallback: if we somehow got text elsewhere, ignore; else hint.
            result.hints.push(
              tr.usedStub
                ? 'Shared audio needs Whisper key + Google — paste a transcript instead.'
                : tr.error,
            )
          }
        } catch (err) {
          result.errors.push(
            err instanceof Error ? err.message : 'share_audio_failed',
          )
        }
      }
    }
  } catch (err) {
    result.errors.push(
      err instanceof Error ? err.message : 'share_consume_failed',
    )
  }

  // SMS inbox — request permission; never silent no-op.
  try {
    let perm = await NativeCapture.checkSmsPermission()
    if (perm.sms !== 'granted') {
      perm = await NativeCapture.requestSmsPermission()
    }
    if (perm.sms !== 'granted') {
      result.hints.push(
        'SMS permission denied — grant SMS, or paste/share a text thread. Play builds may drop READ_SMS later (Notification Listener path).',
      )
    } else {
      const inbox = await NativeCapture.readRecentSms({ max: 50, days: 21 })
      if (!inbox.ok) {
        result.hints.push(
          inbox.hint || inbox.error || 'Could not read SMS inbox.',
        )
      } else {
        const hits = (inbox.messages || []).filter((m) =>
          looksLikeAppointment(m.body),
        )
        if (!hits.length) {
          result.hints.push(
            'SMS inbox scanned — no appointment-like messages in the last 21 days.',
          )
        } else {
          // Batch into one ingest blob so textToCandidates can parse dates.
          const blob = hits
            .map((m) => `From ${m.address || 'SMS'}:\n${m.body}`)
            .join('\n\n---\n\n')
          const { added } = await ingestCaptureText('sms', blob)
          result.smsAdded += added
          if (added === 0) {
            result.hints.push(
              `Found ${hits.length} appointment-like SMS but none parsed into candidates — paste the thread for a sharper parse.`,
            )
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'sms_pull_failed')
    result.hints.push(
      'Native SMS plugin unavailable — paste or share a text thread instead.',
    )
  }

  // Honest OEM voicemail status (always documents limits).
  try {
    const vm = await NativeCapture.getVoicemailStatus()
    if (!vm.oemAvailable && result.voicemailAdded === 0) {
      // Only add hint when we didn't already get shared audio.
      if (!result.hints.some((h) => /voicemail|Whisper|audio/i.test(h))) {
        result.hints.push(vm.hint)
      }
    }
  } catch {
    /* optional */
  }

  return result
}

/** Drain share payload on cold start / resume without waiting for Pull. */
export async function drainShareTargetOnLaunch(): Promise<number> {
  if (!isAndroidNative()) return 0
  try {
    const shared = await NativeCapture.consumeSharedPayload()
    if (!shared.hasPayload) return 0
    let added = 0
    if (shared.text?.trim()) {
      const r = await ingestCaptureText('notes', shared.text)
      added += r.added
    }
    if (shared.audioBase64) {
      const bin = Uint8Array.from(atob(shared.audioBase64), (c) =>
        c.charCodeAt(0),
      )
      const file = new File(
        [new Blob([bin], { type: shared.audioMime || 'audio/mpeg' })],
        shared.audioName || 'shared-voicemail.m4a',
        { type: shared.audioMime || 'audio/mpeg' },
      )
      const tr = await transcribeVoicemailAudio(file)
      if (tr.ok) added += tr.added
    }
    return added
  } catch {
    return 0
  }
}
