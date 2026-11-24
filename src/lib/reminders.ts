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

/** Friendlier preset labels for auto reminders (ids stay stable for saved state). */
export const AUTO_REMINDER_PRESETS = [
  {
    id: 'stack_adhd_default',
    label: 'Balanced',
    hint: 'Day-ahead + leave-now',
  },
  {
    id: 'stack_gentle',
    label: 'Gentle',
    hint: 'Fewer, softer nudges',
  },
  {
    id: 'stack_sprint',
    label: 'Last-minute',
    hint: 'Tight window only',
  },
] as const

export function createDefaultStacks(): ReminderStack[] {
  return [
    {
      id: 'stack_adhd_default',
      name: 'Balanced',
      offsets: DEFAULT_OFFSETS.map((o) => ({ ...o, id: uid('off') })),
    },
    {
      id: 'stack_gentle',
      name: 'Gentle',
      offsets: [
        { id: uid('off'), label: '1 day before', minutesBefore: 24 * 60 },
        { id: uid('off'), label: '1 hour before', minutesBefore: 60 },
        { id: uid('off'), label: '10 min before', minutesBefore: 10 },
      ],
    },
    {
      id: 'stack_sprint',
      name: 'Last-minute',
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

export function leaveOffset(
  offsets: ReminderOffset[],
): ReminderOffset | undefined {
  return offsets.find((o) => /leave/i.test(o.label))
}

export function withLeaveBuffer(
  stack: ReminderStack,
  minutesBefore: number,
): ReminderStack {
  const mins = Math.max(1, Math.min(59, Math.round(minutesBefore)))
  const existing = leaveOffset(stack.offsets)
  if (existing) {
    return {
      ...stack,
      offsets: stack.offsets.map((o) =>
        o.id === existing.id ? { ...o, minutesBefore: mins } : o,
      ),
    }
  }
  return {
    ...stack,
    offsets: [
      ...stack.offsets,
      { id: uid('off'), label: 'Leave now', minutesBefore: mins },
    ],
  }
}

export function presetBlurb(stack: ReminderStack): string {
  const leave = leaveOffset(stack.offsets)
  const others = stack.offsets.filter((o) => !/leave/i.test(o.label))
  const parts = others
    .slice()
    .sort((a, b) => b.minutesBefore - a.minutesBefore)
    .slice(0, 3)
    .map((o) => formatDurationMinutes(o.minutesBefore))
  if (leave) {
    parts.push(`leave ${formatDurationMinutes(leave.minutesBefore)}`)
  }
  return parts.join(' · ')
}
