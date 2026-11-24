import { format, isWithinInterval } from 'date-fns'
import type {
  CalendarEvent,
  DailyTodo,
  GoalPeriod,
  JournalEntry,
  MoodCheckIn,
} from '../types'
import { dayKey } from './dailyTodos'
import { periodKeyFor, periodRange } from './goals'
import { safeParseIso } from './safeDate'

export type CountRow = { label: string; count: number; color?: string }

export type DayScore = {
  date: string
  label: string
  value: number
}

export type ReflectionReport = {
  period: GoalPeriod
  periodKey: string
  moodCounts: CountRow[]
  feelingCounts: CountRow[]
  keywordCounts: CountRow[]
  avgEnergy: number | null
  checkInCount: number
  bestEnergyDays: DayScore[]
  bestMoodDays: DayScore[]
  mostCompletedDays: DayScore[]
  journalCount: number
}

const MOOD_COLORS: Record<string, string> = {
  good: '#3dffd4',
  calm: '#4db8ff',
  okay: '#c8ff4d',
  tired: '#ffb020',
  stressed: '#ff8a4c',
  low: '#ff5c6c',
}

function tally(labels: string[]): CountRow[] {
  const map = new Map<string, number>()
  for (const raw of labels) {
    const label = raw.trim()
    if (!label) continue
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({
      label,
      count,
      color: MOOD_COLORS[label.toLowerCase()],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function topDays(
  scores: Map<string, number>,
  limit = 3,
): DayScore[] {
  return [...scores.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
    .slice(0, limit)
    .map(([date, value]) => ({
      date,
      label: format(new Date(`${date}T12:00:00`), 'EEE · MMM d'),
      value,
    }))
}

export function buildReflectionReport(
  period: GoalPeriod,
  opts: {
    checkIns: MoodCheckIn[]
    journal: JournalEntry[]
    todos: DailyTodo[]
    events: CalendarEvent[]
    date?: Date
  },
): ReflectionReport {
  const date = opts.date ?? new Date()
  const periodKey = periodKeyFor(period, date)
  const { start, end } = periodRange(period, periodKey)
  const interval = { start, end }

  const inRange = (key: string) => {
    try {
      return isWithinInterval(new Date(`${key}T12:00:00`), interval)
    } catch {
      return false
    }
  }

  const checkIns = opts.checkIns.filter((c) => inRange(c.date))
  const journal = opts.journal.filter((j) => inRange(j.date))

  const energyByDay = new Map<string, number[]>()
  for (const c of checkIns) {
    const list = energyByDay.get(c.date) ?? []
    list.push(c.energy)
    energyByDay.set(c.date, list)
  }
  for (const j of journal) {
    if (j.energy == null) continue
    const list = energyByDay.get(j.date) ?? []
    list.push(j.energy)
    energyByDay.set(j.date, list)
  }

  const avgEnergyByDay = new Map<string, number>()
  for (const [d, vals] of energyByDay) {
    avgEnergyByDay.set(
      d,
      vals.reduce((a, b) => a + b, 0) / vals.length,
    )
  }

  // Mood “best” = days with good/calm check-ins preferred (simple score)
  const moodScore = new Map<string, number>()
  for (const c of checkIns) {
    const boost =
      c.categoryId === 'good' || c.categoryId === 'calm'
        ? 2
        : c.categoryId === 'okay'
          ? 1
          : c.categoryId === 'tired' || c.categoryId === 'stressed'
            ? 0.5
            : 0
    moodScore.set(c.date, (moodScore.get(c.date) ?? 0) + 1 + boost + c.energy * 0.15)
  }

  const completedByDay = new Map<string, number>()
  for (const t of opts.todos) {
    if (!t.done || !inRange(t.date)) continue
    completedByDay.set(t.date, (completedByDay.get(t.date) ?? 0) + 1)
  }
  for (const e of opts.events) {
    if (!e.completedAt) continue
    const d = safeParseIso(e.start)
    if (!d) continue
    const key = dayKey(d)
    if (!inRange(key)) continue
    completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1)
  }

  const allEnergy = [...avgEnergyByDay.values()]
  const avgEnergy =
    allEnergy.length === 0
      ? null
      : Math.round(
          (allEnergy.reduce((a, b) => a + b, 0) / allEnergy.length) * 10,
        ) / 10

  const keywords = journal.flatMap((j) => j.keywords)
  const moods = checkIns.map((c) => c.categoryId)
  const feelings = [
    ...checkIns.map((c) => c.feelingLabel),
    ...journal.map((j) => j.feeling).filter(Boolean) as string[],
  ]

  return {
    period,
    periodKey,
    moodCounts: tally(moods),
    feelingCounts: tally(feelings),
    keywordCounts: tally(keywords),
    avgEnergy,
    checkInCount: checkIns.length,
    bestEnergyDays: topDays(avgEnergyByDay),
    bestMoodDays: topDays(moodScore),
    mostCompletedDays: topDays(completedByDay),
    journalCount: journal.length,
  }
}
