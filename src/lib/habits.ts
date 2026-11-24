import {
  eachDayOfInterval,
  format,
  isWithinInterval,
} from 'date-fns'
import type {
  CalendarEvent,
  DailyTodo,
  Goal,
  GoalPeriod,
  TaskGroup,
} from '../types'
import { dayKey } from './dailyTodos'
import { periodKeyFor, periodRange } from './goals'
import { safeParseIso } from './safeDate'

export type HabitGroupStat = {
  groupId: string
  label: string
  color: string
  completed: number
  total: number
  daysActive: number
  /** Days in period with ≥1 completion from this group. */
  streakDays: string[]
}

export type HabitPeriodSummary = {
  period: GoalPeriod
  periodKey: string
  start: string
  end: string
  todoDone: number
  todoTotal: number
  eventsCompleted: number
  eventsTotal: number
  byGroup: HabitGroupStat[]
  goals: Goal[]
}

function eventDayKey(event: CalendarEvent): string | null {
  const d = safeParseIso(event.start)
  return d ? format(d, 'yyyy-MM-dd') : null
}

export function habitSummaryForPeriod(
  period: GoalPeriod,
  opts: {
    todos: DailyTodo[]
    events: CalendarEvent[]
    groups: TaskGroup[]
    goals: Goal[]
    date?: Date
  },
): HabitPeriodSummary {
  const date = opts.date ?? new Date()
  const key = periodKeyFor(period, date)
  const { start, end } = periodRange(period, key)
  const interval = { start, end }

  const todosIn = opts.todos.filter((t) => {
    try {
      return isWithinInterval(new Date(`${t.date}T12:00:00`), interval)
    } catch {
      return false
    }
  })
  const eventsIn = opts.events.filter((e) => {
    const d = safeParseIso(e.start)
    return d ? isWithinInterval(d, interval) : false
  })

  const byGroup: HabitGroupStat[] = opts.groups.map((g) => {
    const groupTodos = todosIn.filter((t) => t.groupId === g.id)
    const streakDays = [
      ...new Set(groupTodos.filter((t) => t.done).map((t) => t.date)),
    ].sort()
    return {
      groupId: g.id,
      label: g.label,
      color: g.color,
      completed: groupTodos.filter((t) => t.done).length,
      total: groupTodos.length,
      daysActive: streakDays.length,
      streakDays,
    }
  })

  const linkedGoals = opts.goals.filter(
    (g) => !g.archived && g.period === period && g.periodKey === key,
  )

  return {
    period,
    periodKey: key,
    start: dayKey(start),
    end: dayKey(end),
    todoDone: todosIn.filter((t) => t.done).length,
    todoTotal: todosIn.length,
    eventsCompleted: eventsIn.filter((e) => Boolean(e.completedAt)).length,
    eventsTotal: eventsIn.length,
    byGroup: byGroup.filter((g) => g.total > 0 || linkedGoals.some((x) => x.taskGroupId === g.groupId)),
    goals: linkedGoals,
  }
}

export function goalProgress(
  goal: Goal,
  todos: DailyTodo[],
  events: CalendarEvent[],
): { done: number; target: number; pct: number } {
  const { start, end } = periodRange(goal.period, goal.periodKey)
  const interval = { start, end }
  let done = 0

  for (const t of todos) {
    if (!t.done) continue
    if (goal.taskGroupId && t.groupId !== goal.taskGroupId) continue
    try {
      if (!isWithinInterval(new Date(`${t.date}T12:00:00`), interval)) continue
    } catch {
      continue
    }
    done += 1
  }

  if (!goal.taskGroupId) {
    for (const e of events) {
      if (!e.completedAt) continue
      const key = eventDayKey(e)
      if (!key) continue
      try {
        if (!isWithinInterval(new Date(`${key}T12:00:00`), interval)) continue
      } catch {
        continue
      }
      done += 1
    }
  }

  const target = Math.max(1, goal.targetCount ?? (goal.period === 'weekly' ? 5 : goal.period === 'monthly' ? 20 : 100))
  const pct = Math.min(100, Math.round((done / target) * 100))
  return { done, target, pct }
}

export function daysInPeriod(period: GoalPeriod, key: string): string[] {
  const { start, end } = periodRange(period, key)
  return eachDayOfInterval({ start, end }).map((d) => dayKey(d))
}
