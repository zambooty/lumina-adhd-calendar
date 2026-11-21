/**
 * Source connectors. Google Calendar + Gmail are live when secrets + OAuth
 * are present; otherwise they fall back to demo mocks. Notes/Texts stay mock
 * only in demo mode — empty when Google is configured and connected.
 */
import type { EventCandidate } from '../types'
import type { ConnectorPullResult, SourceConnector } from './types'
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

export type { SourceConnector, ConnectorPullResult } from './types'
export { googleCalendarConnector, googleCalendarConnectorStub } from './googleCalendar'
export { gmailConnector, gmailConnectorStub } from './gmail'

export const notesConnector: SourceConnector = {
  id: 'notes',
  label: SOURCE_META.notes.label,
  accent: SOURCE_META.notes.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    await delay(220)
    const config = await fetchGoogleConfig()
    const live =
      config.configured && !config.demoMode && Boolean(getGoogleAccessToken())
    // Keep inbox clean during live Google testing — no mock Notes.
    if (live) return { candidates: [] }
    return { candidates: demoNotesCandidates(), usedDemo: true }
  },
}

export const textsConnector: SourceConnector = {
  id: 'texts',
  label: SOURCE_META.texts.label,
  accent: SOURCE_META.texts.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    await delay(190)
    const config = await fetchGoogleConfig()
    const live =
      config.configured && !config.demoMode && Boolean(getGoogleAccessToken())
    // Keep inbox clean during live Google testing — no mock Texts.
    if (live) return { candidates: [] }
    return { candidates: demoTextsCandidates(), usedDemo: true }
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
  // feels alive. In live Google mode, skip extras so Google is the signal.
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
