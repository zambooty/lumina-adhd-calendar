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
  openAppSettings(): Promise<{ ok: boolean; error?: string }>
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

const SMS_PERM_TIMEOUT_MS = 45_000
const SMS_READ_TIMEOUT_MS = 12_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label}_timeout`)),
      ms,
    )
    p.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/** Capacitor may return granted / GRANTED / PermissionState.GRANTED. */
export function normalizeSmsPermission(raw: unknown): 'granted' | 'denied' | 'prompt' {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/permissionstate\./g, '')
    .replace(/_/g, '-')
  if (s === 'granted' || s.endsWith('.granted')) return 'granted'
  if (s === 'denied' || s.endsWith('.denied')) return 'denied'
  return 'prompt'
}

/**
 * Soft pre-filter before textToCandidates. Broader than looksAppointmentLike —
 * include weekdays, month names, and times so we do not drop parseable SMS.
 */
export function looksLikeAppointment(text: string): boolean {
  const t = text.toLowerCase()
  if (t.trim().length < 8) return false
  return (
    /\b(appointment|appt|schedule[d]?|meeting|remind|tomorrow|tonight|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|dentist|doctor|therapy|therapist|checkup|check-up|interview|class|session|consult|booking|reservation|invite)\b/i.test(
      t,
    ) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(t) ||
    /\bat\s+\d{1,2}(:\d{2})?\b/i.test(t) ||
    /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(t) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i.test(
      t,
    )
  )
}

export type SmsPullStatus =
  | 'skipped_web'
  | 'granted_added'
  | 'granted_none'
  | 'granted_empty_inbox'
  | 'denied'
  | 'timeout'
  | 'error'

export type NativePullResult = {
  smsAdded: number
  shareAdded: number
  voicemailAdded: number
  /** How many SMS rows the inbox query returned. */
  smsScanned: number
  smsStatus: SmsPullStatus
  errors: string[]
  hints: string[]
}

const SMS_DENIED_HINT =
  'SMS permission denied — allow SMS in the system prompt (or Settings → Apps → LUMINA → Permissions → SMS), or paste/share a text thread instead.'

/**
 * Cap-only: request SMS if needed, read recent inbox, ingest appointment-like
 * threads; also drain any pending share-target payload into the import queue.
 */
export async function collectNativePullCandidates(): Promise<NativePullResult> {
  const result: NativePullResult = {
    smsAdded: 0,
    shareAdded: 0,
    voicemailAdded: 0,
    smsScanned: 0,
    smsStatus: 'skipped_web',
    errors: [],
    hints: [],
  }

  if (!isNativeCapacitor() || !isAndroidNative()) {
    return result
  }

  // Share target first (user may have shared into LUMINA then tapped Pull).
  try {
    const shared = await withTimeout(
      NativeCapture.consumeSharedPayload(),
      5_000,
      'share_consume',
    )
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

  // SMS inbox — request permission; never silent no-op; never hang Pull forever.
  try {
    let permRaw = await withTimeout(
      NativeCapture.checkSmsPermission(),
      5_000,
      'sms_check',
    )
    let perm = normalizeSmsPermission(permRaw.sms)
    if (perm !== 'granted') {
      try {
        permRaw = await withTimeout(
          NativeCapture.requestSmsPermission(),
          SMS_PERM_TIMEOUT_MS,
          'sms_permission',
        )
        perm = normalizeSmsPermission(permRaw.sms)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'sms_permission_failed'
        if (msg.includes('timeout')) {
          result.smsStatus = 'timeout'
          result.hints.push(
            'SMS permission prompt timed out — tap Pull again and Allow SMS, or paste/share a thread.',
          )
        } else {
          result.smsStatus = 'error'
          result.errors.push(msg)
          result.hints.push(SMS_DENIED_HINT)
        }
        return await withVoicemailHint(result)
      }
    }

    if (perm !== 'granted') {
      result.smsStatus = 'denied'
      result.hints.push(SMS_DENIED_HINT)
      return await withVoicemailHint(result)
    }

    const inbox = await withTimeout(
      NativeCapture.readRecentSms({ max: 200, days: 30 }),
      SMS_READ_TIMEOUT_MS,
      'sms_read',
    )
    if (!inbox.ok) {
      const denied =
        inbox.error === 'sms_permission_denied' ||
        /permission/i.test(inbox.error || '') ||
        /permission/i.test(inbox.hint || '')
      result.smsStatus = denied ? 'denied' : 'error'
      result.hints.push(
        inbox.hint ||
          inbox.error ||
          (denied ? SMS_DENIED_HINT : 'Could not read SMS inbox.'),
      )
      return await withVoicemailHint(result)
    }

    const messages = Array.isArray(inbox.messages) ? inbox.messages : []
    result.smsScanned = messages.length

    if (!messages.length) {
      result.smsStatus = 'granted_empty_inbox'
      result.hints.push(
        'SMS permission OK — inbox empty in the last 30 days. Paste or share a thread instead.',
      )
      return await withVoicemailHint(result)
    }

    // Per-message ingest so titles stay useful and parse can catch month-name dates.
    let parsedHits = 0
    for (const m of messages) {
      const body = (m.body || '').trim()
      if (!looksLikeAppointment(body)) continue
      parsedHits += 1
      const { added } = await ingestCaptureText(
        'sms',
        `From ${m.address || 'SMS'}:\n${body}`,
      )
      result.smsAdded += added
    }

    if (result.smsAdded > 0) {
      result.smsStatus = 'granted_added'
    } else if (parsedHits > 0) {
      result.smsStatus = 'granted_none'
      result.hints.push(
        `Scanned ${messages.length} SMS · ${parsedHits} looked appointment-like but none parsed into candidates — paste the thread for a sharper parse.`,
      )
    } else {
      result.smsStatus = 'granted_none'
      result.hints.push(
        `SMS inbox scanned (${messages.length} recent) — no appointment-like messages in the last 30 days. Paste or share a thread if you have one.`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'sms_pull_failed'
    result.errors.push(msg)
    if (msg.includes('timeout')) {
      result.smsStatus = 'timeout'
      result.hints.push(
        'SMS read timed out — Pull continued without texts. Paste or share a thread, or try again.',
      )
    } else {
      result.smsStatus = 'error'
      result.hints.push(
        'Native SMS plugin unavailable — paste or share a text thread instead.',
      )
    }
  }

  return await withVoicemailHint(result)
}

async function withVoicemailHint(
  result: NativePullResult,
): Promise<NativePullResult> {
  try {
    const vm = await withTimeout(
      NativeCapture.getVoicemailStatus(),
      3_000,
      'voicemail_status',
    )
    if (!vm.oemAvailable && result.voicemailAdded === 0) {
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
    const shared = await withTimeout(
      NativeCapture.consumeSharedPayload(),
      5_000,
      'share_launch',
    )
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
