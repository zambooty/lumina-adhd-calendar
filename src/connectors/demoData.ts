import { addDays, setHours, setMinutes } from 'date-fns'
import type { EventCandidate, SourceKind } from '../types'
import { uid } from '../lib/id'

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
  texts: { label: 'SMS', accent: '#ffb020' },
  voicemail: { label: 'Voicemail', accent: '#ff7ad9' },
}

export { SOURCE_META }

export function demoCalendarCandidates(): EventCandidate[] {
  const start = at(3, 15)
  const end = new Date(start.getTime() + 45 * 60 * 1000)
  return [
    {
      id: uid('cand'),
      title: 'All-hands meeting',
      start: start.toISOString(),
      end: end.toISOString(),
      location: 'Room B / Hybrid',
      source: 'calendar',
      sourceLabel: 'Demo Calendar · Work · shared',
      rawSnippet: 'All-hands: Wednesday 3:00 PM — Hybrid / Room B.',
      confidence: 0.97,
      status: 'pending',
      color: '#3dffd4',
    },
  ]
}

export function demoEmailCandidates(): EventCandidate[] {
  const start = at(5, 11)
  const end = new Date(start.getTime() + 45 * 60 * 1000)
  return [
    {
      id: uid('cand'),
      title: 'Pottery class',
      start: start.toISOString(),
      end: end.toISOString(),
      location: 'Clay Studio',
      source: 'email',
      sourceLabel: 'Demo Gmail · bookings@studio.demo',
      rawSnippet:
        'Your pottery class is booked for Saturday at 11:00 AM. Arrive 10 minutes early.',
      confidence: 0.93,
      status: 'pending',
      color: '#4db8ff',
    },
  ]
}

export function demoNotesCandidates(): EventCandidate[] {
  const start = at(2, 10, 30)
  const end = new Date(start.getTime() + 45 * 60 * 1000)
  return [
    {
      id: uid('cand'),
      title: 'Call insurance',
      start: start.toISOString(),
      end: end.toISOString(),
      source: 'notes',
      sourceLabel: 'Notes · Brain dump',
      rawSnippet: 'call insurance Tue 10:30 about claim #4421',
      confidence: 0.84,
      status: 'pending',
      color: '#c8ff4d',
    },
  ]
}

export function demoTextsCandidates(): EventCandidate[] {
  const start = at(4, 7)
  const end = new Date(start.getTime() + 45 * 60 * 1000)
  return [
    {
      id: uid('cand'),
      title: 'Gym with Sam',
      start: start.toISOString(),
      end: end.toISOString(),
      location: 'Ironworks Gym',
      source: 'texts',
      sourceLabel: 'Texts · Sam',
      rawSnippet: 'Sam: gym Thursday 7am? I’ll save you a rack.',
      confidence: 0.86,
      status: 'pending',
      color: '#ffb020',
    },
  ]
}

export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
