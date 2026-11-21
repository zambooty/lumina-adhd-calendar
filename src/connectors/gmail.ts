import type { EventCandidate, SourceConnector } from '../types'

/**
 * Future real connector — Gmail API (OAuth).
 * Priority #2 real integration (right after Google Calendar).
 *
 * Implementation sketch (do not call from MVP):
 * - OAuth2 with gmail.readonly
 * - Search confirmation / invite-like messages
 * - Heuristic parse of appointment times → EventCandidate
 *
 * Until wired, the mock `emailConnector` in `./index.ts` is used.
 */
export const gmailConnectorStub: SourceConnector = {
  id: 'email',
  label: 'Gmail',
  accent: '#4db8ff',
  async listCandidates(): Promise<EventCandidate[]> {
    throw new Error(
      'Gmail connector not configured — use mock emailConnector for MVP.',
    )
  },
}
