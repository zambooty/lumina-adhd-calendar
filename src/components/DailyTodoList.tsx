import { addDays, format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import type { DailyTodo, TodoRepeat } from '../types'
import {
  dayKey,
  parseDayKey,
  REPEAT_OPTIONS,
  todosForDay,
} from '../lib/dailyTodos'

type Props = {
  todos: DailyTodo[]
  dateKey?: string
  compact?: boolean
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

export function DailyTodoList({
  todos,
  dateKey: dateKeyProp,
  compact = false,
  onEnsureDay,
  onAdd,
  onToggle,
  onRemove,
  onSetRepeat,
}: Props) {
  const [internalDateKey, setInternalDateKey] = useState(dayKey())
  const [draft, setDraft] = useState('')
  const [repeat, setRepeat] = useState<TodoRepeat>('none')
  const [openRepeatId, setOpenRepeatId] = useState<string | null>(null)
  const dateKey = dateKeyProp ?? internalDateKey

  useEffect(() => {
    onEnsureDay?.(dateKey)
  }, [dateKey, onEnsureDay])

  const dayTodos = useMemo(() => todosForDay(todos, dateKey), [todos, dateKey])
  const doneCount = dayTodos.filter((t) => t.done).length
  const day = parseDayKey(dateKey)
  const isToday = dateKey === dayKey()
  const setDateKey = (key: string) => {
    if (!dateKeyProp) setInternalDateKey(key)
  }

  function submit() {
    const title = draft.trim()
    if (!title) return
    onAdd({ title, date: dateKey, repeat })
    setDraft('')
    setRepeat('none')
  }

  return (
    <div className={`daily-todos${compact ? ' daily-todos--compact' : ''}`}>
      {!compact && (
        <div className="daily-todos-nav">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Previous day"
            onClick={() => setDateKey(dayKey(addDays(day, -1)))}
          >
            ←
          </button>
          <div className="daily-todos-date">
            <strong>{isToday ? 'Today' : format(day, 'EEE · MMM d')}</strong>
            <span>
              {doneCount}/{dayTodos.length} done
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Next day"
            onClick={() => setDateKey(dayKey(addDays(day, 1)))}
          >
            →
          </button>
        </div>
      )}

      {compact && (
        <div className="daily-todos-compact-head">
          <span className="daily-todos-compact-count">
            {doneCount}/{dayTodos.length}
          </span>
        </div>
      )}

      <ul className="daily-todo-list" aria-label="Daily todos">
        <AnimatePresence initial={false}>
          {dayTodos.map((todo) => (
            <motion.li
              key={todo.id}
              className={`daily-todo-row${todo.done ? ' is-done' : ''}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              layout
            >
              <button
                type="button"
                className="daily-todo-check"
                aria-pressed={todo.done}
                aria-label={todo.done ? 'Mark incomplete' : 'Mark done'}
                style={{ borderColor: todo.color, color: todo.color }}
                onClick={() => onToggle(todo.id)}
              >
                {todo.done ? '✓' : ''}
              </button>
              <div className="daily-todo-copy">
                <span
                  className="daily-todo-title"
                  style={{ ['--todo-accent' as string]: todo.color }}
                >
                  {todo.title}
                </span>
                {!compact && todo.repeat !== 'none' && (
                  <span className="daily-todo-repeat-tag">
                    {todo.repeat}
                  </span>
                )}
              </div>
              {!compact && (
                <div className="daily-todo-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={openRepeatId === todo.id}
                    onClick={() =>
                      setOpenRepeatId((id) =>
                        id === todo.id ? null : todo.id,
                      )
                    }
                  >
                    Repeat
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`Remove ${todo.title}`}
                    onClick={() => onRemove(todo.id)}
                  >
                    ✕
                  </button>
                </div>
              )}
              {!compact && openRepeatId === todo.id && (
                <div className="daily-todo-repeat-picker" role="group">
                  {REPEAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`daily-todo-repeat-opt${
                        todo.repeat === opt.id ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        onSetRepeat(todo.id, opt.id)
                        setOpenRepeatId(null)
                      }}
                    >
                      <strong>{opt.label}</strong>
                      <span>{opt.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!compact && dayTodos.length === 0 && (
        <p className="daily-todos-empty">
          Nothing here yet — add a quick win or pull from a task group.
        </p>
      )}

      {!compact && (
        <form
          className="daily-todo-add"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            className="daily-todo-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a todo…"
            aria-label="New todo title"
          />
          <select
            className="daily-todo-repeat-select"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as TodoRepeat)}
            aria-label="Repeat"
          >
            {REPEAT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary btn-sm">
            Add
          </button>
        </form>
      )}
    </div>
  )
}
