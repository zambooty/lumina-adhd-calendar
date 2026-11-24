import type { ReminderOffset, ReminderStack } from '../types'
import { formatDurationMinutes } from './duration'
import { uid } from './id'

export const DEFAULT_OFFSETS: ReminderOffset[] = [
  { id: 'off_1d', label: '1 day before', minutesBefore: 24 * 60 },
  { id: 'off_2h', label: '2 hours before', minutesBefore: 2 * 60 },
  { id: 'off_30m', label: '30 min before', minutesBefore: 30 },
  { id: 'off_5m', label: '5 min before', minutesBefore: 5 },
  { id: 'off_leave', label: 'Leave now', minutesBefore: 15 },
]

export function createDefaultStacks(): ReminderStack[] {
  return [
    {
      id: 'stack_adhd_default',
      name: 'ADHD default stack',
      offsets: DEFAULT_OFFSETS.map((o) => ({ ...o, id: uid('off') })),
    },
    {
      id: 'stack_gentle',
      name: 'Gentle nudge',
      offsets: [
        { id: uid('off'), label: '1 day before', minutesBefore: 24 * 60 },
        { id: uid('off'), label: '1 hour before', minutesBefore: 60 },
        { id: uid('off'), label: '10 min before', minutesBefore: 10 },
      ],
    },
    {
      id: 'stack_sprint',
      name: 'Last-minute sprint',
      offsets: [
        { id: uid('off'), label: '45 min before', minutesBefore: 45 },
        { id: uid('off'), label: '15 min before', minutesBefore: 15 },
        { id: uid('off'), label: 'Leave now', minutesBefore: 8 },
      ],
    },
  ]
}

export function formatOffset(minutesBefore: number): string {
  return formatDurationMinutes(minutesBefore)
}
