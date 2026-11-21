import { differenceInMinutes, isAfter, isBefore, isSameDay } from 'date-fns'
import type { CalendarEvent, ReminderStack } from '../types'
import { safeParseIso } from './safeDate'

/** Leave-now offset typically 8–15m before start; prefer stack “Leave now” if present. */
export function leaveBufferMinutes(
  event: CalendarEvent,
  stacks: ReminderStack[],
): number {
  const stack =
    stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0]
  const offsets = event.reminderOverride ?? stack?.offsets ?? []
  const leave = offsets.find((o) => /leave/i.test(o.label))
  if (leave) return leave.minutesBefore
  const near = offsets
    .map((o) => o.minutesBefore)
    .filter((m) => m > 0 && m <= 30)
    .sort((a, b) => a - b)
  return near[0] ?? 15
}

export function stackArmed(
  event: CalendarEvent,
  stacks: ReminderStack[],
): boolean {
  const stack =
    stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0]
  const offsets = event.reminderOverride ?? stack?.offsets ?? []
  return offsets.length > 0
}

/** Current or next event for the NOW panel (in-progress first, then soonest upcoming). */
export function pickNowEvent(
  events: CalendarEvent[],
  now = new Date(),
): CalendarEvent | null {
  const parsed = events
    .map((e) => {
      const start = safeParseIso(e.start)
      const end = safeParseIso(e.end)
      if (!start || !end) return null
      return { e, start, end }
    })
    .filter((x): x is { e: CalendarEvent; start: Date; end: Date } =>
      Boolean(x),
    )

  const inProgress = parsed.find(
    ({ start, end }) => !isAfter(start, now) && isAfter(end, now),
  )
  if (inProgress) return inProgress.e

  const upcoming = parsed
    .filter(({ end }) => isAfter(end, now))
    .sort((a, b) => +a.start - +b.start)
  return upcoming[0]?.e ?? null
}

export function minutesUntilLeave(
  event: CalendarEvent,
  stacks: ReminderStack[],
  now = new Date(),
): number | null {
  const start = safeParseIso(event.start)
  if (!start) return null
  const buffer = leaveBufferMinutes(event, stacks)
  const leaveAt = new Date(+start - buffer * 60_000)
  return differenceInMinutes(leaveAt, now)
}

/** 0–1 progress toward leave time (clamped). */
export function leaveProgress(
  event: CalendarEvent,
  stacks: ReminderStack[],
  now = new Date(),
): number {
  const start = safeParseIso(event.start)
  if (!start) return 0
  const buffer = leaveBufferMinutes(event, stacks)
  const leaveAt = +start - buffer * 60_000
  // ADHD glance: fill rises across a multi-hour approach window, not only the last hour.
  const windowMs = Math.max(buffer * 60_000, 3 * 60 * 60_000)
  const windowStart = leaveAt - windowMs
  if (now.getTime() <= windowStart) return 0.06
  if (now.getTime() >= leaveAt) return 1
  return 0.06 + 0.94 * ((now.getTime() - windowStart) / windowMs)
}

export type RibbonBlock = {
  id: string
  timeLabel: string
  title: string
  meta?: string
  tone: 'past' | 'focus' | 'soon' | 'idle'
  eventId?: string
  accent?: 'amber' | 'lime' | 'cyan'
}

/** Spatial day ribbon: past muted, current edged, a few upcoming blocks. */
export function buildDayRibbon(
  events: CalendarEvent[],
  focusId: string | null,
  now = new Date(),
): RibbonBlock[] {
  const dayEvents = events
    .map((e) => {
      const start = safeParseIso(e.start)
      const end = safeParseIso(e.end)
      if (!start || !end || !isSameDay(start, now)) return null
      return { e, start, end }
    })
    .filter((x): x is { e: CalendarEvent; start: Date; end: Date } =>
      Boolean(x),
    )
    .sort((a, b) => +a.start - +b.start)

  if (dayEvents.length === 0) {
    return [
      {
        id: 'quiet-open',
        timeLabel: '—',
        title: 'Open day',
        meta: 'Pull something in',
        tone: 'idle',
      },
    ]
  }

  const blocks: RibbonBlock[] = []
  const first = dayEvents[0]
  if (isAfter(first.start, now)) {
    blocks.push({
      id: 'quiet-before',
      timeLabel: formatHour(
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8),
      ),
      title: 'Quiet',
      tone: 'past',
    })
  }

  for (let i = 0; i < dayEvents.length; i++) {
    const { e, start, end } = dayEvents[i]
    const past = isBefore(end, now) || +end === +now
    const inProgress = !isAfter(start, now) && isAfter(end, now)
    const isFocus = e.id === focusId || inProgress
    let accent: RibbonBlock['accent']
    if (!past && !isFocus) {
      accent = i % 3 === 1 ? 'amber' : i % 3 === 2 ? 'lime' : 'cyan'
    }
    blocks.push({
      id: e.id,
      eventId: e.id,
      timeLabel: formatHour(start),
      title: shortTitle(e.title),
      meta: isFocus ? 'in focus' : undefined,
      tone: past ? 'past' : isFocus ? 'focus' : 'soon',
      accent,
    })
  }

  // If nothing marked focus, edge the next upcoming block
  if (!blocks.some((b) => b.tone === 'focus')) {
    const next = blocks.find((b) => b.tone === 'soon')
    if (next) {
      next.tone = 'focus'
      next.meta = 'in focus'
      next.accent = undefined
    }
  }

  return blocks.slice(0, 4)
}

function formatHour(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = ((h + 11) % 12) + 1
  if (m === 0) return `${h12}:00`
  return `${h12}:${String(m).padStart(2, '0')}`
}

function shortTitle(title: string): string {
  const t = title.trim()
  if (t.length <= 18) return t
  return `${t.slice(0, 16)}…`
}

export function nextUpEvents(
  events: CalendarEvent[],
  now = new Date(),
  limit = 3,
): CalendarEvent[] {
  return events
    .filter((e) => {
      const end = safeParseIso(e.end)
      return end ? isAfter(end, now) : false
    })
    .slice(0, limit)
}
