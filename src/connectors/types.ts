/**
 * Connector contract for source pulls + optional text/audio ingest.
 *
 * Priority for real integrations:
 *   1. Google Calendar  → `calendar`
 *   2. Gmail            → `email` (Gmail)
 *   3. Notes / IMAP / SMS / Voicemail (this slice)
 *
 * `listCandidates` returns candidates plus optional error/demo flags so the
 * inbox can show honest empty/error feedback instead of silent failures.
 *
 * Import helpers (`ingestText`) feed a local queue consumed on the next pull.
 * Live provider hooks sit behind secrets; paste/upload always works.
 */
import type { EventCandidate, SourceKind } from '../types'

export type ConnectorPullResult = {
  candidates: EventCandidate[]
  /** Live call failed (auth, scopes, network, API). */
  error?: string
  /** True when sample/demo data was returned instead of live / imported. */
  usedDemo?: boolean
  /** Human-readable hint when live/import returned zero candidates. */
  emptyHint?: string
  /** How many recurring/identical instances were collapsed before return. */
  seriesCollapsed?: number
}

export type SourceConnector = {
  id: SourceKind
  label: string
  accent: string
  listCandidates: () => Promise<ConnectorPullResult>
  /**
   * Optional: parse pasted / uploaded text into candidates and stash for pull.
   * Returns how many appointment-like items were detected.
   */
  ingestText?: (text: string, meta?: { label?: string }) => Promise<{
    added: number
    candidates: EventCandidate[]
  }>
}

/** Optional IMAP account prefs (host/user only — never persist raw passwords in git). */
export type ImapAccountPrefs = {
  host: string
  port: number
  user: string
  /** Provider hint for UI copy */
  provider: 'outlook' | 'yahoo' | 'icloud' | 'generic'
}

/** Capture provider status (secrets present or not — never values). */
export type CaptureProviderStatus = {
  twilioConfigured: boolean
  whisperConfigured: boolean
  imapLiveConfigured: boolean
}
