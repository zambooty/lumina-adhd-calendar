/**
 * Connector contract for source pulls.
 *
 * Real-integration priority (confirmed):
 *   1. Google Calendar  → replace mock `calendar` connector
 *   2. Gmail            → replace mock `email` connector
 *   3. Notes / Texts    → later
 *
 * Keep `listCandidates()` returning `EventCandidate[]` so the inbox UI
 * stays unchanged when swapping mocks for OAuth-backed clients.
 */
export type { SourceConnector, SourceKind, EventCandidate } from '../types'
