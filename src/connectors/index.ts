/**
 * Source connectors. Google Calendar + Gmail are live when secrets + OAuth
 * are present; otherwise they fall back to demo mocks. Notes/Texts stay mock.
 */
import type { EventCandidate, SourceConnector } from '../types'
import { freshPullBatch } from '../lib/seed'
import { fetchGoogleConfig } from '../lib/googleConfig'
import { getGoogleAccessToken } from '../lib/googleAuth'
import {
  delay,
  demoNotesCandidates,
  demoTextsCandidates,
  SOURCE_META,
} from './demoData'
import { googleCalendarConnector } from './googleCalendar'
import { gmailConnector } from './gmail'

export type { SourceConnector } from './types'
export { googleCalendarConnector, googleCalendarConnectorStub } from './googleCalendar'
export { gmailConnector, gmailConnectorStub } from './gmail'

export const notesConnector: SourceConnector = {
  id: 'notes',
  label: SOURCE_META.notes.label,
  accent: SOURCE_META.notes.accent,
  async listCandidates() {
    await delay(220)
    return demoNotesCandidates()
  },
}

export const textsConnector: SourceConnector = {
  id: 'texts',
  label: SOURCE_META.texts.label,
  accent: SOURCE_META.texts.accent,
  async listCandidates() {
    await delay(190)
    return demoTextsCandidates()
  },
}

export const calendarConnector = googleCalendarConnector
export const emailConnector = gmailConnector

export const connectors: SourceConnector[] = [
  googleCalendarConnector,
  notesConnector,
  gmailConnector,
  textsConnector,
]

export type PullMeta = {
  mode: 'live' | 'demo' | 'mixed'
  googleConfigured: boolean
  googleConnected: boolean
}

export async function pullAllSources(): Promise<{
  candidates: EventCandidate[]
  meta: PullMeta
}> {
  const config = await fetchGoogleConfig()
  const connected = Boolean(getGoogleAccessToken())
  const live =
    config.configured && !config.demoMode && connected

  const fromConnectors = (
    await Promise.all(connectors.map((c) => c.listCandidates()))
  ).flat()

  // In demo mode, mix a rotating fresh batch so each pull feels alive.
  // In live mode, skip extras so Google results stay the signal.
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
    },
  }
}
