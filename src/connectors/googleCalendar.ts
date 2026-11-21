import type { EventCandidate, SourceConnector } from '../types'

/**
 * Future real connector — Google Calendar API (OAuth).
 * Priority #1 real integration after this mock MVP ships.
 *
 * Implementation sketch (do not call from MVP):
 * - OAuth2 with calendar.readonly (and events write if auto-add pushes back)
 * - list upcoming + recently created events / shared calendars
 * - map to EventCandidate; high-confidence items can auto-add
 *
 * Until wired, the mock `calendarConnector` in `./index.ts` is used.
 */
export const googleCalendarConnectorStub: SourceConnector = {
  id: 'calendar',
  label: 'Google Calendar',
  accent: '#3dffd4',
  async listCandidates(): Promise<EventCandidate[]> {
    throw new Error(
      'Google Calendar connector not configured — use mock calendarConnector for MVP.',
    )
  },
}
