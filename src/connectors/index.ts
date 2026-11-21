import type { EventCandidate, SourceConnector, SourceKind } from '../types'
import { freshPullBatch } from '../lib/seed'
import { uid } from '../lib/id'
import { addDays, setHours, setMinutes } from 'date-fns'

function at(dayOffset: number, hour: number, minute = 0): Date {
  return addDays(setMinutes(setHours(new Date(), hour), minute), dayOffset)
}

const SOURCE_META: Record<
  SourceKind,
  { label: string; accent: string }
> = {
  calendar: { label: 'Calendar', accent: '#3dffd4' },
  notes: { label: 'Notes', accent: '#c8ff4d' },
  email: { label: 'Email', accent: '#4db8ff' },
  texts: { label: 'Texts', accent: '#ffb020' },
}

/** Parse-ish demo: appointment phrases → candidates (mock NLP). */
function parseAppointmentLike(
  source: SourceKind,
  items: { label: string; snippet: string; title: string; day: number; hour: number; minute?: number; location?: string; confidence: number; color: string }[],
): EventCandidate[] {
  return items.map((item) => {
    const start = at(item.day, item.hour, item.minute ?? 0)
    const end = new Date(start.getTime() + 45 * 60 * 1000)
    return {
      id: uid('cand'),
      title: item.title,
      start: start.toISOString(),
      end: end.toISOString(),
      location: item.location,
      source,
      sourceLabel: `${SOURCE_META[source].label} · ${item.label}`,
      rawSnippet: item.snippet,
      confidence: item.confidence,
      status: 'pending' as const,
      color: item.color,
    }
  })
}

export const calendarConnector: SourceConnector = {
  id: 'calendar',
  label: SOURCE_META.calendar.label,
  accent: SOURCE_META.calendar.accent,
  async listCandidates() {
    await delay(280)
    return parseAppointmentLike('calendar', [
      {
        label: 'Work · shared',
        snippet: 'All-hands: Wednesday 3:00 PM — Hybrid / Room B.',
        title: 'All-hands meeting',
        day: 3,
        hour: 15,
        confidence: 0.97,
        color: '#3dffd4',
        location: 'Room B / Hybrid',
      },
    ])
  },
}

export const notesConnector: SourceConnector = {
  id: 'notes',
  label: SOURCE_META.notes.label,
  accent: SOURCE_META.notes.accent,
  async listCandidates() {
    await delay(220)
    return parseAppointmentLike('notes', [
      {
        label: 'Brain dump',
        snippet: 'call insurance Tue 10:30 about claim #4421',
        title: 'Call insurance',
        day: 2,
        hour: 10,
        minute: 30,
        confidence: 0.84,
        color: '#c8ff4d',
      },
    ])
  },
}

export const emailConnector: SourceConnector = {
  id: 'email',
  label: SOURCE_META.email.label,
  accent: SOURCE_META.email.accent,
  async listCandidates() {
    await delay(340)
    return parseAppointmentLike('email', [
      {
        label: 'bookings@studio.demo',
        snippet:
          'Your pottery class is booked for Saturday at 11:00 AM. Arrive 10 minutes early.',
        title: 'Pottery class',
        day: 5,
        hour: 11,
        confidence: 0.93,
        color: '#4db8ff',
        location: 'Clay Studio',
      },
    ])
  },
}

export const textsConnector: SourceConnector = {
  id: 'texts',
  label: SOURCE_META.texts.label,
  accent: SOURCE_META.texts.accent,
  async listCandidates() {
    await delay(190)
    return parseAppointmentLike('texts', [
      {
        label: 'Sam',
        snippet: 'Sam: gym Thursday 7am? I’ll save you a rack.',
        title: 'Gym with Sam',
        day: 4,
        hour: 7,
        confidence: 0.86,
        color: '#ffb020',
        location: 'Ironworks Gym',
      },
    ])
  },
}

export const connectors: SourceConnector[] = [
  calendarConnector,
  notesConnector,
  emailConnector,
  textsConnector,
]

export async function pullAllSources(): Promise<EventCandidate[]> {
  const fromConnectors = (
    await Promise.all(connectors.map((c) => c.listCandidates()))
  ).flat()
  // Mix connector results with a rotating fresh batch so each pull feels alive
  const extras = freshPullBatch().slice(0, 2)
  return [...fromConnectors, ...extras]
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
