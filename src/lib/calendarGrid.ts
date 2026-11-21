import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { CalendarEvent } from '../types'
import { safeParseIso } from './safeDate'

export const WEEK_STARTS_ON = 0 as const // Sunday — familiar phone-calendar default

export function monthMatrix(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON })
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON })
  return eachDayOfInterval({ start, end })
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function eventStartDate(event: CalendarEvent): Date | null {
  return safeParseIso(event.start)
}

export function eventEndDate(event: CalendarEvent): Date | null {
  return safeParseIso(event.end) ?? eventStartDate(event)
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = startOfDay(day).getTime()
  return events
    .filter((e) => {
      const start = eventStartDate(e)
      if (!start) return false
      return startOfDay(start).getTime() === key
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

export function eventsInRange(
  events: CalendarEvent[],
  start: Date,
  end: Date,
): CalendarEvent[] {
  const lo = startOfDay(start).getTime()
  const hi = startOfDay(end).getTime() + 24 * 60 * 60 * 1000 - 1
  return events
    .filter((e) => {
      const s = eventStartDate(e)
      if (!s) return false
      const t = s.getTime()
      return t >= lo && t <= hi
    })
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
}

/** Minutes from midnight for layout; clamps overnight ends to same day for MVP. */
export function dayMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function eventLayoutInDay(
  event: CalendarEvent,
  day: Date,
  dayStartHour: number,
  dayEndHour: number,
): { topPct: number; heightPct: number } | null {
  const start = eventStartDate(event)
  const end = eventEndDate(event)
  if (!start || !end) return null
  if (!isSameDay(start, day)) return null

  const windowStart = dayStartHour * 60
  const windowEnd = dayEndHour * 60
  const windowSpan = Math.max(1, windowEnd - windowStart)

  let startMin = dayMinutes(start)
  let endMin = dayMinutes(end)
  if (endMin <= startMin) endMin = startMin + 30

  startMin = Math.max(windowStart, Math.min(windowEnd, startMin))
  endMin = Math.max(startMin + 20, Math.min(windowEnd, endMin))

  const topPct = ((startMin - windowStart) / windowSpan) * 100
  const heightPct = ((endMin - startMin) / windowSpan) * 100
  return { topPct, heightPct }
}

export function isOutsideMonth(day: Date, anchor: Date): boolean {
  return !isSameMonth(day, anchor)
}
