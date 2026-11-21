/**
 * Connector contract for source pulls.
 *
 * Real-integration priority:
 *   1. Google Calendar  → `googleCalendarConnector` (live + demo fallback)
 *   2. Gmail            → `gmailConnector` (live + demo fallback)
 *   3. Notes / Texts    → still mock
 *
 * Keep `listCandidates()` returning `EventCandidate[]` so the inbox UI
 * stays unchanged when swapping mocks for OAuth-backed clients.
 */
export type { SourceConnector, SourceKind, EventCandidate } from '../types'
