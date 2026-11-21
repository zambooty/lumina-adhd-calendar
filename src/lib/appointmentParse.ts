import { addDays, addHours, setHours, setMinutes, setSeconds } from 'date-fns'

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

/** Heuristic appointment datetime from free text (email snippets, etc.). */
export function parseAppointmentWhen(
  text: string,
  now = new Date(),
): { start: Date; end: Date; confidenceBoost: number } | null {
  const lower = text.toLowerCase()

  // ISO-ish or explicit date: 2026-11-25 14:00 / Nov 25, 2026 at 2:00 PM
  const iso = text.match(
    /(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})\s*(am|pm)?/i,
  )
  if (iso) {
    let hour = Number(iso[2])
    const minute = Number(iso[3])
    const mer = iso[4]?.toLowerCase()
    if (mer === 'pm' && hour < 12) hour += 12
    if (mer === 'am' && hour === 12) hour = 0
    const start = new Date(`${iso[1]}T00:00:00`)
    start.setHours(hour, minute, 0, 0)
    return {
      start,
      end: addHours(start, 1),
      confidenceBoost: 0.12,
    }
  }

  const named = text.match(
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i,
  )
  if (named) {
    const months: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    }
    const rawMon = named[1].toLowerCase()
    const month =
      months[rawMon] ??
      months[rawMon.slice(0, 3)] ??
      (rawMon.startsWith('sept') ? 8 : undefined)
    const day = Number(named[2])
    const year = named[3] ? Number(named[3]) : now.getFullYear()
    let hour = named[4] ? Number(named[4]) : 10
    const minute = named[5] ? Number(named[5]) : 0
    const mer = named[6]?.toLowerCase()
    if (mer === 'pm' && hour < 12) hour += 12
    if (mer === 'am' && hour === 12) hour = 0
    if (month === undefined || Number.isNaN(day)) return null
    const start = new Date(year, month, day, hour, minute, 0, 0)
    if (start < now) start.setFullYear(start.getFullYear() + 1)
    return { start, end: addHours(start, 1), confidenceBoost: 0.1 }
  }

  const weekdayTime = lower.match(
    /\b(today|tomorrow|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r(?:s|sday)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b(?:[^\n]{0,40}?)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  )
  if (weekdayTime) {
    const dayToken = weekdayTime[1].toLowerCase()
    let hour = Number(weekdayTime[2])
    const minute = Number(weekdayTime[3] ?? 0)
    const mer = weekdayTime[4]?.toLowerCase()
    if (mer === 'pm' && hour < 12) hour += 12
    if (mer === 'am' && hour === 12) hour = 0
    if (!mer && hour < 8) hour += 12 // default afternoon-ish for bare hours

    let start: Date
    if (dayToken === 'today') {
      start = setSeconds(setMinutes(setHours(now, hour), minute), 0)
    } else if (dayToken === 'tomorrow') {
      start = setSeconds(
        setMinutes(setHours(addDays(now, 1), hour), minute),
        0,
      )
    } else {
      const target = WEEKDAYS[dayToken] ?? WEEKDAYS[dayToken.slice(0, 3)]
      if (target === undefined) return null
      let delta = (target - now.getDay() + 7) % 7
      if (delta === 0) delta = 7
      start = setSeconds(
        setMinutes(setHours(addDays(now, delta), hour), minute),
        0,
      )
    }
    return { start, end: addHours(start, 1), confidenceBoost: 0.08 }
  }

  return null
}

export function looksAppointmentLike(text: string): boolean {
  return /\b(appointment|confirm(?:ed|ation)?|scheduled|booking|reservation|invite|meeting|dentist|doctor|therapy|therapist|checkup|check-up|interview|class|session|consult)\b/i.test(
    text,
  )
}
