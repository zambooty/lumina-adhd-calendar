import { addDays, addHours, setHours, setMinutes } from 'date-fns'
import type { AppState, CalendarEvent, EventCandidate } from '../types'
import { uid } from './id'
import { createDefaultStacks } from './reminders'
import { createSeedTaskGroups } from './taskGroups'

function at(dayOffset: number, hour: number, minute = 0): Date {
  const base = setMinutes(setHours(new Date(), hour), minute)
  return addDays(base, dayOffset)
}

function iso(d: Date): string {
  return d.toISOString()
}

/** Empty starter — used when Google is live / after wipe so no fake appointments linger. */
export function createEmptyState(): AppState {
  const stacks = createDefaultStacks()
  const now = new Date().toISOString()
  return {
    events: [],
    candidates: [],
    defaultStackId: stacks[0].id,
    stacks,
    pet: {
      name: 'Blink',
      eventsPulled: 0,
      eventsScheduled: 0,
    },
    autoAddHighConfidence: true,
    hasSeenHero: false,
    seededAt: now,
    dismissedKeys: [],
    taskGroups: createSeedTaskGroups(),
    todoTemplates: [],
    dailyTodos: [],
    moodCheckIns: [],
  }
}

/** Demo-only seed for offline / secrets-unset mode. Not used when Google is live. */
export function createSeedState(): AppState {
  const stacks = createDefaultStacks()
  const defaultStackId = stacks[0].id
  const now = new Date().toISOString()

  const events: CalendarEvent[] = [
    {
      id: uid('evt'),
      title: 'Therapist check-in',
      start: iso(at(0, 14, 0)),
      end: iso(at(0, 15, 0)),
      location: 'Video · Zoom',
      notes: 'Bring notes from the week.',
      source: 'calendar',
      sourceLabel: 'Existing calendar',
      color: '#3dffd4',
      categoryId: 'health',
      reminderStackId: defaultStackId,
      createdAt: now,
    },
    {
      id: uid('evt'),
      title: 'Pharmacy pickup',
      start: iso(at(1, 11, 30)),
      end: iso(at(1, 12, 0)),
      location: 'Corner Care Pharmacy',
      color: '#ff5c6c',
      categoryId: 'errands',
      reminderStackId: defaultStackId,
      createdAt: now,
    },
    {
      id: uid('evt'),
      title: 'Deep work block — portfolio',
      start: iso(at(2, 10, 0)),
      end: iso(at(2, 12, 0)),
      notes: 'Phone in another room.',
      color: '#c8ff4d',
      categoryId: 'focus',
      reminderStackId: stacks[1].id,
      createdAt: now,
    },
  ]

  const candidates: EventCandidate[] = [
    {
      id: uid('cand'),
      title: 'Dentist cleaning',
      start: iso(at(3, 9, 15)),
      end: iso(at(3, 10, 0)),
      location: 'Bright Smile Dental',
      source: 'email',
      sourceLabel: 'Email · confirmations@brightsmile.demo',
      rawSnippet:
        'Hi! Your cleaning is confirmed for Thursday at 9:15 AM at Bright Smile Dental. Reply CANCEL to reschedule.',
      confidence: 0.94,
      status: 'pending',
      color: '#4db8ff',
    },
    {
      id: uid('cand'),
      title: 'Coffee with Jordan',
      start: iso(at(1, 16, 0)),
      end: iso(at(1, 17, 0)),
      location: 'Harbor Roasters',
      source: 'texts',
      sourceLabel: 'Texts · Jordan',
      rawSnippet: 'Jordan: coffee tomorrow at 4 at Harbor? I’ll grab a table.',
      confidence: 0.88,
      status: 'pending',
      color: '#ffb020',
    },
    {
      id: uid('cand'),
      title: 'Submit lease renewal docs',
      start: iso(at(4, 17, 0)),
      end: iso(at(4, 17, 30)),
      source: 'notes',
      sourceLabel: 'Notes · Life admin',
      rawSnippet: 'TODO: lease renewal due Friday 5pm — drop docs in portal.',
      confidence: 0.81,
      status: 'pending',
      color: '#c8ff4d',
    },
  ]

  return {
    events,
    candidates,
    defaultStackId,
    stacks,
    pet: {
      name: 'Blink',
      eventsPulled: 2,
      eventsScheduled: 1,
    },
    autoAddHighConfidence: true,
    hasSeenHero: false,
    seededAt: now,
    dismissedKeys: [],
    taskGroups: createSeedTaskGroups(),
    todoTemplates: [],
    dailyTodos: [],
    moodCheckIns: [],
  }
}

/** Extra mock pulls for “Pull from sources” — demo mode only. */
export function freshPullBatch(): EventCandidate[] {
  const stamp = Date.now()
  return [
    {
      id: uid('cand'),
      title: 'Eye exam follow-up',
      start: iso(addHours(at(5, 13, 0), 0)),
      end: iso(addHours(at(5, 13, 45), 0)),
      location: 'Lens Lab',
      source: 'calendar',
      sourceLabel: 'Shared calendar · Family',
      rawSnippet: 'Eye exam follow-up — next Monday 1:00 PM (Lens Lab).',
      confidence: 0.96,
      status: 'pending',
      color: '#3dffd4',
    },
    {
      id: uid('cand'),
      title: 'Team standup (optional)',
      start: iso(at(0, 9, 30)),
      end: iso(at(0, 9, 45)),
      source: 'email',
      sourceLabel: 'Email · standup@acme.demo',
      rawSnippet: `Daily standup invite for ${new Date().toLocaleDateString()} at 9:30 AM.`,
      confidence: 0.72,
      status: 'pending',
      color: '#4db8ff',
    },
    {
      id: uid('cand'),
      title: 'Mom — Sunday dinner',
      start: iso(at(6, 18, 0)),
      end: iso(at(6, 20, 0)),
      location: "Mom's place",
      source: 'texts',
      sourceLabel: 'Texts · Mom',
      rawSnippet: 'Mom: dinner Sunday 6? Your sister’s bringing dessert 🍰',
      confidence: 0.91,
      status: 'pending',
      color: '#ff5c6c',
    },
    {
      id: uid('cand'),
      title: 'Renew library books',
      start: iso(at(2, 12, 0)),
      end: iso(at(2, 12, 15)),
      source: 'notes',
      sourceLabel: 'Notes · Errands',
      rawSnippet: `sticky #${stamp % 1000}: renew library books by Wed noon`,
      confidence: 0.77,
      status: 'pending',
      color: '#c8ff4d',
    },
  ]
}
