import { addDays, subDays } from 'date-fns'
import type { EventCandidate } from '../types'
import type { ConnectorPullResult, SourceConnector } from './types'
import { uid } from '../lib/id'
import { fetchGoogleConfig } from '../lib/googleConfig'
import {
  clearGoogleToken,
  ensureGoogleAccessToken,
  getGoogleAccessToken,
  getGoogleGrantedScopes,
} from '../lib/googleAuth'
import {
  classifyGoogleApiError,
  googleAuthHeaders,
} from '../lib/googleApiAuth'
import { hasCalendarScope } from '../lib/googleScopes'
import { delay, demoCalendarCandidates, SOURCE_META } from './demoData'

type GCalEvent = {
  id?: string
  summary?: string
  description?: string
  location?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  htmlLink?: string
}

type GCalList = {
  items?: GCalEvent[]
}

type CalendarList = {
  items?: { id?: string; summary?: string; primary?: boolean; selected?: boolean }[]
}

function mapCalendarEvent(
  ev: GCalEvent,
  calendarLabel: string,
): EventCandidate | null {
  if (ev.status === 'cancelled') return null
  const startRaw = ev.start?.dateTime ?? ev.start?.date
  const endRaw = ev.end?.dateTime ?? ev.end?.date
  if (!startRaw) return null
  const start = new Date(startRaw)
  if (Number.isNaN(start.getTime())) return null
  const end = endRaw
    ? new Date(endRaw)
    : new Date(start.getTime() + 45 * 60 * 1000)
  if (Number.isNaN(end.getTime())) return null
  const title = (ev.summary ?? 'Untitled event').trim()
  if (!title) return null

  const snippetBits = [
    title,
    ev.location ? ` @ ${ev.location}` : '',
    ev.description ? ` — ${ev.description.slice(0, 140)}` : '',
  ]
  const allDay = Boolean(ev.start?.date && !ev.start?.dateTime)

  return {
    id: uid('cand'),
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    location: ev.location,
    notes: ev.description,
    source: 'calendar',
    sourceLabel: calendarLabel,
    rawSnippet: snippetBits.join('').slice(0, 220),
    // Keep below auto-add threshold so inbox shows what was pulled;
    // user can still one-tap schedule.
    confidence: allDay ? 0.86 : 0.89,
    status: 'pending',
    color: SOURCE_META.calendar.accent,
  }
}

async function listCalendarIds(accessToken: string): Promise<
  { id: string; label: string }[]
> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=20&minAccessRole=reader',
    {
      headers: googleAuthHeaders(accessToken),
    },
  )
  if (res.status === 401 || res.status === 403) {
    const failure = await classifyGoogleApiError(res, 'Google Calendar')
    throw Object.assign(new Error(failure.message), { googleFailure: failure })
  }
  if (!res.ok) {
    // Non-auth failure — fall back to primary only
    return [{ id: 'primary', label: 'Google Calendar · primary' }]
  }
  const data = (await res.json()) as CalendarList
  const picked = (data.items ?? [])
    .filter((c) => c.id && (c.selected !== false || c.primary))
    .slice(0, 8)
    .map((c) => ({
      id: c.id!,
      label: c.primary
        ? 'Google Calendar · primary'
        : `Google Calendar · ${c.summary ?? c.id}`,
    }))
  return picked.length
    ? picked
    : [{ id: 'primary', label: 'Google Calendar · primary' }]
}

async function listEventsForCalendar(
  accessToken: string,
  calendarId: string,
  label: string,
): Promise<EventCandidate[]> {
  const timeMin = subDays(new Date(), 2).toISOString()
  const timeMax = addDays(new Date(), 60).toISOString()
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '40',
  })
  const encoded = encodeURIComponent(calendarId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encoded}/events?${params}`,
    {
      headers: googleAuthHeaders(accessToken),
    },
  )
  if (res.status === 401 || res.status === 403) {
    const failure = await classifyGoogleApiError(res, 'Google Calendar')
    throw Object.assign(new Error(failure.message), { googleFailure: failure })
  }
  if (!res.ok) {
    throw new Error(`calendar_api_${res.status}`)
  }
  const data = (await res.json()) as GCalList
  return (data.items ?? [])
    .map((ev) => mapCalendarEvent(ev, label))
    .filter((c): c is EventCandidate => Boolean(c))
}

async function listFromGoogle(accessToken: string): Promise<EventCandidate[]> {
  const calendars = await listCalendarIds(accessToken)
  const batches = await Promise.all(
    calendars.map(async (cal) => {
      try {
        return await listEventsForCalendar(accessToken, cal.id, cal.label)
      } catch (err) {
        const failure = (
          err as { googleFailure?: { shouldClearToken?: boolean } }
        ).googleFailure
        if (failure?.shouldClearToken) throw err
        // One calendar failing shouldn't wipe the whole pull
        return [] as EventCandidate[]
      }
    }),
  )
  const seen = new Set<string>()
  const out: EventCandidate[] = []
  for (const batch of batches) {
    for (const c of batch) {
      const key = `${c.title}|${c.start}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

/**
 * Google Calendar connector — live when OAuth token + secrets exist;
 * otherwise demo/mock candidates.
 */
export const googleCalendarConnector: SourceConnector = {
  id: 'calendar',
  label: 'Google Calendar',
  accent: SOURCE_META.calendar.accent,
  async listCandidates(): Promise<ConnectorPullResult> {
    const config = await fetchGoogleConfig()
    // Renew expired access tokens before treating as demo.
    if (config.configured && !config.demoMode && !getGoogleAccessToken()) {
      await ensureGoogleAccessToken()
    }
    const token = getGoogleAccessToken()

    if (!config.configured || config.demoMode || !token) {
      await delay(280)
      return { candidates: demoCalendarCandidates(), usedDemo: true }
    }

    const granted = getGoogleGrantedScopes()
    if (granted && !hasCalendarScope(granted)) {
      return {
        candidates: [],
        error:
          'Google Calendar scope missing — reconnect Google and allow calendar.readonly.',
      }
    }

    try {
      const candidates = await listFromGoogle(token)
      return {
        candidates,
        emptyHint:
          candidates.length === 0
            ? 'No events in the next 60 days on your selected Google calendars.'
            : undefined,
      }
    } catch (err) {
      const failure = (err as { googleFailure?: import('../lib/googleApiAuth').GoogleApiFailure })
        .googleFailure
      if (failure) {
        if (failure.shouldClearToken) clearGoogleToken()
        return { candidates: [], error: failure.message }
      }
      const message = err instanceof Error ? err.message : 'calendar_error'
      return {
        candidates: [],
        error: `Google Calendar pull failed (${message}).`,
      }
    }
  },
}

/** @deprecated use googleCalendarConnector */
export const googleCalendarConnectorStub = googleCalendarConnector
