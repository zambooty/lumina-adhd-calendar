/**
 * Connector contract for source pulls.
 *
 * Priority for real integrations:
 *   1. Google Calendar  → replace mock `calendar` connector
 *   2. Gmail            → replace mock `email` connector
 *   3. Notes / Texts
 *
 * `listCandidates` returns candidates plus optional error/demo flags so the
 * inbox can show honest empty/error feedback instead of silent failures.
 */
import type { EventCandidate, SourceKind } from '../types'

export type ConnectorPullResult = {
  candidates: EventCandidate[]
  /** Live Google call failed (auth, scopes, network, API). */
  error?: string
  /** True when sample/demo data was returned instead of live Google. */
  usedDemo?: boolean
  /** Human-readable hint when live returned zero candidates. */
  emptyHint?: string
}

export type SourceConnector = {
  id: SourceKind
  label: string
  accent: string
  listCandidates: () => Promise<ConnectorPullResult>
}
