import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import type { Goal, GoalPeriod, TaskGroup } from '../types'
import { dayKey, parseDayKey } from './dailyTodos'

export const GOAL_PERIODS: {
  id: GoalPeriod
  label: string
  short: string
}[] = [
  { id: 'weekly', label: 'This week', short: 'Week' },
  { id: 'monthly', label: 'This month', short: 'Month' },
  { id: 'yearly', label: 'This year', short: 'Year' },
]

/** Monday-start week key used for weekly goals. */
export function periodKeyFor(period: GoalPeriod, date: Date = new Date()): string {
  if (period === 'weekly') {
    return dayKey(startOfWeek(date, { weekStartsOn: 1 }))
  }
  if (period === 'monthly') {
    return dayKey(startOfMonth(date))
  }
  return dayKey(startOfYear(date))
}

export function periodRange(
  period: GoalPeriod,
  key: string,
): { start: Date; end: Date } {
  const anchor = parseDayKey(key)
  if (period === 'weekly') {
    const start = startOfWeek(anchor, { weekStartsOn: 1 })
    return { start, end: endOfWeek(anchor, { weekStartsOn: 1 }) }
  }
  if (period === 'monthly') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
  }
  return { start: startOfYear(anchor), end: endOfYear(anchor) }
}

export function periodLabel(period: GoalPeriod, key: string): string {
  const { start, end } = periodRange(period, key)
  if (period === 'weekly') {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
  }
  if (period === 'monthly') {
    return format(start, 'MMMM yyyy')
  }
  return format(start, 'yyyy')
}

/** Soft prompts — ADHD-friendly, not productivity guilt. */
export const GOAL_PROMPTS: Record<GoalPeriod, string[]> = {
  weekly: [
    'What’s one gentle win you want this week?',
    'Which habit deserves a soft spotlight this week?',
    'What would “enough” look like by Sunday?',
  ],
  monthly: [
    'What theme do you want this month to carry?',
    'Which task group should get more love this month?',
    'What would make this month feel kinder?',
  ],
  yearly: [
    'What direction feels true for this year?',
    'Which category of care do you want to grow into?',
    'What would Future You thank you for starting?',
  ],
}

export function pickGoalPrompt(
  period: GoalPeriod,
  seed = Date.now(),
): string {
  const list = GOAL_PROMPTS[period]
  return list[seed % list.length]!
}

/** Build a draft goal title from a task group (“count as goals”). */
export function goalTitleFromGroup(
  group: TaskGroup,
  period: GoalPeriod,
): string {
  const span =
    period === 'weekly' ? 'this week' : period === 'monthly' ? 'this month' : 'this year'
  return `Lean into ${group.label.toLowerCase()} ${span}`
}

export function activeGoalsForPeriod(
  goals: Goal[],
  period: GoalPeriod,
  date: Date = new Date(),
): Goal[] {
  const key = periodKeyFor(period, date)
  return goals.filter(
    (g) => !g.archived && g.period === period && g.periodKey === key,
  )
}

export function goalsNeedingPrompt(
  goals: Goal[],
  date: Date = new Date(),
): GoalPeriod[] {
  return GOAL_PERIODS.filter(
    ({ id }) => activeGoalsForPeriod(goals, id, date).length === 0,
  ).map(({ id }) => id)
}
