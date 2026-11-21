import { addDays } from 'date-fns'
import type { EventCandidate, SourceConnector } from '../types'
import { uid } from '../lib/id'
import { fetchGoogleConfig } from '../lib/googleConfig'
import { getGoogleAccessToken } from '../lib/googleAuth'
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

function mapCalendarEvent(ev: GCalEvent): EventCandidate | null {
  if (ev.status === 'cancelled') return null
  const startRaw = ev.start?.dateTime ?? ev.start?.date
  const endRaw = ev.end?.dateTime ?? ev.end?.date
  if (!startRaw) return null
  const start = new Date(startRaw)
  const end = endRaw
    ? new Date(endRaw)
    : new Date(start.getTime() + 45 * 60 * 1000)
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
    sourceLabel: 'Google Calendar · primary',
    rawSnippet: snippetBits.join('').slice(0, 220),
    confidence: allDay ? 0.88 : 0.96,
    status: 'pending',
    color: SOURCE_META.calendar.accent,
  }
}

async function listFromGoogle(accessToken: string): Promise<EventCandidate[]> {
  const timeMin = new Date().toISOString()
  const timeMax = addDays(new Date(), 45).toISOString()
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
    },
  )
  if (!res.ok) {
    throw new Error(`calendar_api_${res.status}`)
  }
  const data = (await res.json()) as GCalList
  return (data.items ?? [])
    .map(mapCalendarEvent)
    .filter((c): c is EventCandidate => Boolean(c))
}

/**
 * Google Calendar connector — live when OAuth token + secrets exist;
 * otherwise demo/mock candidates.
 */
export const googleCalendarConnector: SourceConnector = {
  id: 'calendar',
  label: 'Google Calendar',
  accent: SOURCE_META.calendar.accent,
  async listCandidates(): Promise<EventCandidate[]> {
    const config = await fetchGoogleConfig()
    const token = getGoogleAccessToken()

    if (!config.configured || config.demoMode || !token) {
      await delay(280)
      return demoCalendarCandidates()
    }

    try {
      return await listFromGoogle(token)
    } catch {
      await delay(200)
      return demoCalendarCandidates()
    }
  },
}

/** @deprecated use googleCalendarConnector */
export const googleCalendarConnectorStub = googleCalendarConnector
