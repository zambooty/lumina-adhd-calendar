import {
  addMonths,
  format,
  getDate,
  isSameMonth,
  isToday,
  startOfMonth,
} from 'date-fns'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { CalendarEvent, DailyTodo } from '../types'
import {
  dayKey,
  monthSummary,
  monthTodoStats,
  parseDayKey,
  todosForDay,
} from '../lib/dailyTodos'
import { safeFormatIso, safeParseIso } from '../lib/safeDate'
import { DailyTodoList } from './DailyTodoList'
import type { TodoRepeat } from '../types'

type Props = {
  todos: DailyTodo[]
  events: CalendarEvent[]
  onEnsureDay?: (dateKey: string) => void
  onAdd: (input: {
    title: string
    date?: string
    repeat?: TodoRepeat
  }) => void
  onToggle: (todoId: string) => void
  onRemove: (todoId: string) => void
  onSetRepeat: (todoId: string, repeat: TodoRepeat) => void
}

export function AgendaView({
  todos,
  events,
  onEnsureDay,
  onAdd,
  onToggle,
  onRemove,
  onSetRepeat,
}: Props) {
  const [selectedKey, setSelectedKey] = useState(dayKey())
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()))

  const dayTodos = useMemo(
    () => todosForDay(todos, selectedKey),
    [todos, selectedKey],
  )
  const dayEvents = useMemo(() => {
    return events
      .filter((e) => {
        const s = safeParseIso(e.start)
        return s ? format(s, 'yyyy-MM-dd') === selectedKey : false
      })
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  }, [events, selectedKey])

  const stats = useMemo(
    () => monthTodoStats(todos, monthAnchor),
    [todos, monthAnchor],
  )
  const summary = useMemo(() => monthSummary(stats), [stats])

  const selectedLabel =
    selectedKey === dayKey()
      ? 'Today'
      : format(parseDayKey(selectedKey), 'EEE · MMM d')

  return (
    <div className="agenda-view">
      <section className="agenda-day" aria-label="Day agenda">
        <header className="agenda-day-head">
          <h3>{selectedLabel}</h3>
          <p>
            {dayTodos.length} tasks
            {dayEvents.length > 0 ? ` · ${dayEvents.length} events` : ''}
          </p>
        </header>

        {dayEvents.length > 0 && (
          <ul className="agenda-events">
            {dayEvents.map((ev) => (
              <li key={ev.id} className="agenda-event-row">
                <span
                  className="agenda-event-dot"
                  style={{ background: ev.color }}
                  aria-hidden
                />
                <span className="agenda-event-time">
                  {safeFormatIso(ev.start, 'h:mm a')}
                </span>
                <span className="agenda-event-title">{ev.title}</span>
              </li>
            ))}
          </ul>
        )}

        <DailyTodoList
          todos={todos}
          dateKey={selectedKey}
          onEnsureDay={onEnsureDay}
          onAdd={onAdd}
          onToggle={onToggle}
          onRemove={onRemove}
          onSetRepeat={onSetRepeat}
        />
      </section>

      <section className="agenda-month" aria-label="Monthly task review">
        <header className="agenda-month-head">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Previous month"
            onClick={() => setMonthAnchor((m) => addMonths(m, -1))}
          >
            ←
          </button>
          <div>
            <h3>{format(monthAnchor, 'MMMM yyyy')}</h3>
            <p>
              {summary.done}/{summary.total} done · {summary.daysWithTasks}{' '}
              active days
              {summary.bestDay
                ? ` · best ${format(parseDayKey(summary.bestDay.date), 'MMM d')} (${summary.bestDay.done})`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Next month"
            onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
          >
            →
          </button>
        </header>

        <div className="agenda-month-grid" role="grid">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={`${d}-${i}`} className="agenda-month-dow" role="columnheader">
              {d}
            </span>
          ))}
          {/* Pad to weekday of month start */}
          {Array.from({ length: monthAnchor.getDay() }).map((_, i) => (
            <span key={`pad-${i}`} className="agenda-month-cell is-pad" />
          ))}
          {stats.map((s) => {
            const d = parseDayKey(s.date)
            const ratio = s.total ? s.done / s.total : 0
            const selected = s.date === selectedKey
            return (
              <motion.button
                key={s.date}
                type="button"
                role="gridcell"
                className={`agenda-month-cell${selected ? ' is-selected' : ''}${
                  isToday(d) ? ' is-today' : ''
                }${s.total === 0 ? ' is-empty' : ''}`}
                style={
                  s.total > 0
                    ? {
                        ['--fill' as string]: `${Math.round(ratio * 100)}%`,
                      }
                    : undefined
                }
                onClick={() => setSelectedKey(s.date)}
                aria-label={`${format(d, 'MMM d')}: ${s.done} of ${s.total} done`}
                whileTap={{ scale: 0.94 }}
              >
                <span className="agenda-month-num">{getDate(d)}</span>
                {s.total > 0 && (
                  <span className="agenda-month-bar" aria-hidden>
                    <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        {!isSameMonth(parseDayKey(selectedKey), monthAnchor) && (
          <p className="agenda-month-hint">
            Selected day is outside this month — tap a day above to jump.
          </p>
        )}
      </section>
    </div>
  )
}
