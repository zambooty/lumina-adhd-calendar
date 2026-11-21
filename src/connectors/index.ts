/**
 * Source connectors.
 * Google Calendar + Gmail are live when secrets + OAuth are present.
 * Notes / IMAP / SMS / Voicemail: paste-import always; demo only when not live;
 * optional Twilio / Whisper / IMAP-live behind secrets.
 */
import type { EventCandidate } from '../types'
import type { SourceConnector } from './types'
import { freshPullBatch } from '../lib/seed'
import { fetchGoogleConfig } from '../lib/googleConfig'
import { getGoogleAccessToken } from '../lib/googleAuth'
import { googleCalendarConnector } from './googleCalendar'
import { gmailConnector } from './gmail'
import { notesConnector } from './notes'
import { imapEmailConnector } from './imapEmail'
import { smsConnector } from './sms'
import { voicemailConnector } from './voicemail'

export type { SourceConnector, ConnectorPullResult } from './types'
export type { CaptureProviderStatus, ImapAccountPrefs } from './types'
export { googleCalendarConnector, googleCalendarConnectorStub } from './googleCalendar'
export { gmailConnector, gmailConnectorStub } from './gmail'
export { notesConnector } from './notes'
export { imapEmailConnector } from './imapEmail'
export { smsConnector } from './sms'
export { voicemailConnector, transcribeVoicemailAudio } from './voicemail'

/** @deprecated alias — prefer smsConnector */
export const textsConnector = smsConnector

export const calendarConnector = googleCalendarConnector
export const emailConnector = gmailConnector

/** All pullable connectors (Gmail + IMAP both contribute email candidates). */
export const connectors: SourceConnector[] = [
  googleCalendarConnector,
  notesConnector,
  gmailConnector,
  imapEmailConnector,
  smsConnector,
  voicemailConnector,
]

/** Connectors shown as source chips (stable order). */
export const sourceChips: SourceConnector[] = [
  googleCalendarConnector,
  gmailConnector,
  notesConnector,
  imapEmailConnector,
  smsConnector,
  voicemailConnector,
]

export type PullMeta = {
  mode: 'live' | 'demo' | 'mixed'
  googleConfigured: boolean
  googleConnected: boolean
  freshCount: number
  errors: string[]
  emptyHints: string[]
  usedDemoSources: string[]
  /** Recurring instances collapsed inside connectors before inbox filter. */
  seriesCollapsed: number
}

export async function pullAllSources(): Promise<{
  candidates: EventCandidate[]
  meta: PullMeta
}> {
  const config = await fetchGoogleConfig()
  const connected = Boolean(getGoogleAccessToken())
  const live = config.configured && !config.demoMode && connected

  const results = await Promise.all(connectors.map((c) => c.listCandidates()))
  const fromConnectors = results.flatMap((r) => r.candidates)
  const errors = results
    .map((r) => r.error)
    .filter((e): e is string => Boolean(e))
  const emptyHints = results
    .map((r) => r.emptyHint)
    .filter((h): h is string => Boolean(h))
  const usedDemoSources = connectors
    .filter((_, i) => results[i]?.usedDemo)
    .map((c) => c.label)
  const seriesCollapsed = results.reduce(
    (sum, r) => sum + (r.seriesCollapsed ?? 0),
    0,
  )

  // In demo / not-connected mode, mix a rotating fresh batch so each pull
  // feels alive. In live Google mode, skip extras so Google + imports are the signal.
  const extras = live ? [] : freshPullBatch().slice(0, 2)
  const candidates = [...fromConnectors, ...extras]

  let mode: PullMeta['mode'] = 'demo'
  if (live) mode = 'live'
  else if (config.configured) mode = 'mixed'

  return {
    candidates,
    meta: {
      mode,
      googleConfigured: config.configured,
      googleConnected: connected,
      freshCount: candidates.length,
      errors,
      emptyHints,
      usedDemoSources,
      seriesCollapsed,
    },
  }
}

/** Ingest helpers keyed by capture tab id. */
export async function ingestCaptureText(
  kind: 'notes' | 'imap' | 'sms' | 'voicemail',
  text: string,
): Promise<{ added: number; candidates: EventCandidate[] }> {
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
