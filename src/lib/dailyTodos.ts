import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isWeekend,
  parseISO,
  startOfMonth,
} from 'date-fns'
import type { DailyTodo, TodoRepeat, TodoTemplate } from '../types'
import { uid } from './id'

/** Local calendar day key (yyyy-MM-dd). */
export function dayKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDayKey(key: string): Date {
  // Local noon avoids DST edge flips when formatting back
  return parseISO(`${key}T12:00:00`)
}

export function repeatApplies(repeat: TodoRepeat, date: Date, weekday?: number): boolean {
  switch (repeat) {
    case 'none':
      return false
    case 'daily':
      return true
    case 'weekdays':
      return !isWeekend(date)
    case 'weekly':
      return weekday == null ? true : getDay(date) === weekday
    default:
      return false
  }
}

export function todosForDay(todos: DailyTodo[], key: string): DailyTodo[] {
  return todos
    .filter((t) => t.date === key)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return a.title.localeCompare(b.title)
    })
}

/** Spawn missing instances from active templates for a given day. */
export function materializeTemplates(
  templates: TodoTemplate[],
  todos: DailyTodo[],
  key: string,
): DailyTodo[] {
  const day = parseDayKey(key)
  const existing = new Set(
    todos.filter((t) => t.date === key && t.templateId).map((t) => t.templateId!),
  )
  const spawned: DailyTodo[] = []
  const now = new Date().toISOString()

  for (const tpl of templates) {
    if (!tpl.active) continue
    if (!repeatApplies(tpl.repeat, day, tpl.repeatWeekday)) continue
    if (existing.has(tpl.id)) continue
    spawned.push({
      id: uid('todo'),
      title: tpl.title,
      date: key,
      done: false,
      color: tpl.color,
      groupId: tpl.groupId,
      templateId: tpl.id,
      repeat: tpl.repeat,
      repeatWeekday: tpl.repeatWeekday,
      createdAt: now,
    })
  }
  return spawned
}

export type MonthDayStats = {
  date: string
  total: number
  done: number
}

export function monthTodoStats(
  todos: DailyTodo[],
  monthAnchor: Date,
): MonthDayStats[] {
  const start = startOfMonth(monthAnchor)
  const end = endOfMonth(monthAnchor)
  return eachDayOfInterval({ start, end }).map((d) => {
    const key = dayKey(d)
    const dayTodos = todos.filter((t) => t.date === key)
    return {
      date: key,
      total: dayTodos.length,
      done: dayTodos.filter((t) => t.done).length,
    }
  })
}

export function monthSummary(stats: MonthDayStats[]): {
  daysWithTasks: number
  total: number
  done: number
  bestDay: MonthDayStats | null
} {
  const withTasks = stats.filter((s) => s.total > 0)
  const total = withTasks.reduce((n, s) => n + s.total, 0)
  const done = withTasks.reduce((n, s) => n + s.done, 0)
  let bestDay: MonthDayStats | null = null
  for (const s of withTasks) {
    if (!bestDay || s.done > bestDay.done) bestDay = s
  }
  return { daysWithTasks: withTasks.length, total, done, bestDay }
}

export const REPEAT_OPTIONS: { id: TodoRepeat; label: string; hint: string }[] = [
  { id: 'none', label: 'Once', hint: 'Just this day' },
  { id: 'daily', label: 'Daily', hint: 'Every day' },
  { id: 'weekdays', label: 'Weekdays', hint: 'Mon–Fri' },
  { id: 'weekly', label: 'Weekly', hint: 'Same weekday' },
]
