import { useEffect, useMemo, useState } from 'react'
import type {
  CalendarEntryKind,
  CalendarEvent,
  DailyTodo,
  PetState,
  ReminderStack,
  TodoRepeat,
} from '../types'
import { formatLeaveIn } from '../lib/duration'
import { safeFormatIso } from '../lib/safeDate'
import { petXp } from '../lib/pet'
import {
  buildDayRibbon,
  leaveProgress,
  minutesUntilLeave,
  pickNowEvent,
  stackArmed,
} from '../lib/mixFocus'
import { dayKey, todosForDay } from '../lib/dailyTodos'
import { CalendarView } from './CalendarView'
import { UpcomingList } from './UpcomingList'
import { DailyTodoList } from './DailyTodoList'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
  pet: PetState
  dailyTodos?: DailyTodo[]
  onChangeStack: (eventId: string, stackId: string) => void
  onChangeCategory?: (eventId: string, categoryId: string) => void
  onAddEntry?: (input: {
    title: string
    start: string
    end: string
    kind: CalendarEntryKind
    categoryId?: string
    notes?: string
  }) => string
  focusEventId?: string | null
  onFocusConsumed?: () => void
  onOpenEvent?: (id: string) => void
  onEnsureDayTodos?: (dateKey: string) => void
  onAddDailyTodo?: (input: {
    title: string
    date?: string
    repeat?: TodoRepeat
  }) => void
  onToggleDailyTodo?: (todoId: string) => void
  onRemoveDailyTodo?: (todoId: string) => void
  onSetTodoRepeat?: (todoId: string, repeat: TodoRepeat) => void
  onOpenAgenda?: () => void
}

export function MixHome({
  events,
  stacks,
  pet,
  dailyTodos = [],
  onChangeStack,
  onChangeCategory,
  onAddEntry,
  focusEventId,
  onFocusConsumed,
  onOpenEvent,
  onEnsureDayTodos,
  onAddDailyTodo,
  onToggleDailyTodo,
  onRemoveDailyTodo,
  onSetTodoRepeat,
  onOpenAgenda,
}: Props) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const nowEvent = useMemo(() => pickNowEvent(events, now), [events, now])
  const focusId = nowEvent?.id ?? null
  const ribbon = useMemo(
    () => buildDayRibbon(events, focusId, now),
    [events, focusId, now],
  )

  const leaveMins =
    nowEvent != null ? minutesUntilLeave(nowEvent, stacks, now) : null
  const progress =
    nowEvent != null ? leaveProgress(nowEvent, stacks, now) : 0
  const armed = nowEvent != null && stackArmed(nowEvent, stacks)
  const xp = petXp(pet)

  function openEvent(eventId: string) {
    onOpenEvent?.(eventId)
  }

  const leaveCopy = leaveMins == null ? null : formatLeaveIn(leaveMins)
  const todayTodos = todosForDay(dailyTodos, dayKey())
  const todayDone = todayTodos.filter((t) => t.done).length
  const showDaily =
    onAddDailyTodo &&
    onToggleDailyTodo &&
    onRemoveDailyTodo &&
    onSetTodoRepeat

  return (
    <div className="mix-home">
      <div className="mix-main">
        <section
          className="mix-glass mix-now"
          role="status"
          aria-live="polite"
        >
          <div className="mix-now-label">NOW</div>
          {nowEvent ? (
            <>
              <button
                type="button"
                className="mix-now-title"
                onClick={() => openEvent(nowEvent.id)}
              >
                {nowEvent.title}
              </button>
              <p className="mix-now-meta">
                {safeFormatIso(nowEvent.start, 'h:mm')}
                {' – '}
                {safeFormatIso(nowEvent.end, 'h:mm')}
                {leaveCopy ? ` · ${leaveCopy}` : ''}
                {armed ? ' · stack armed' : ''}
              </p>
              <div className="mix-progress" aria-hidden>
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </>
          ) : (
            <>
              <h2 className="mix-now-title mix-now-title--static">
                Nothing next
              </h2>
              <p className="mix-now-meta">
                Pull appointments in — Blink is waiting to glow.
              </p>
              <div className="mix-progress" aria-hidden>
                <span style={{ width: '8%' }} />
              </div>
            </>
          )}
        </section>

        <div className="mix-ribbon" aria-label="Today’s blocks">
          {ribbon.map((block) => (
            <button
              key={block.id}
              type="button"
              className={`mix-block mix-block--${block.tone}${
                block.accent ? ` mix-block--${block.accent}` : ''
              }`}
              disabled={!block.eventId}
              onClick={() => block.eventId && openEvent(block.eventId)}
            >
              <span
                className={`mix-block-time${
                  block.accent ? ` is-${block.accent}` : ''
                }`}
              >
                {block.timeLabel}
              </span>
              <span className="mix-block-title">{block.title}</span>
              {block.meta && (
                <span className="mix-block-meta">{block.meta}</span>
              )}
            </button>
          ))}
        </div>

        <CalendarView
          events={events}
          stacks={stacks}
          onChangeStack={onChangeStack}
          onChangeCategory={onChangeCategory}
          onAddEntry={onAddEntry}
          focusEventId={focusEventId}
          onFocusConsumed={onFocusConsumed}
        />

        <section className="mix-glass mix-upcoming" aria-label="Upcoming">
          <div className="mix-upcoming-head">
            <h2 className="mix-rail-title">Upcoming</h2>
            <p className="mix-rail-hint">What&apos;s next — reminders included.</p>
          </div>
          <div className="mix-upcoming-body">
            <UpcomingList
              events={events}
              stacks={stacks}
              onChangeStack={onChangeStack}
              onOpenEvent={openEvent}
            />
          </div>
        </section>

        {showDaily && (
          <section
            className="mix-glass mix-daily"
            aria-label="Today’s todos"
          >
            <div className="mix-daily-head">
              <div>
                <h2 className="mix-rail-title">Today&apos;s todos</h2>
                <p className="mix-rail-hint">
                  {todayTodos.length === 0
                    ? 'Quick wins for today — pull from task groups in the menu.'
                    : `${todayDone} of ${todayTodos.length} done`}
                </p>
              </div>
              {onOpenAgenda && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onOpenAgenda}
                >
                  Agenda
                </button>
              )}
            </div>
            <DailyTodoList
              todos={dailyTodos}
              compact
              onEnsureDay={onEnsureDayTodos}
              onAdd={onAddDailyTodo}
              onToggle={onToggleDailyTodo}
              onRemove={onRemoveDailyTodo}
              onSetRepeat={onSetTodoRepeat}
            />
            {todayTodos.length === 0 && (
              <p className="mix-rail-empty">
                Open menu → Daily todos or Task groups to start.
              </p>
            )}
          </section>
        )}

        <div className="mix-whisper mix-whisper--mobile" aria-live="polite">
          <span className="mix-whisper-orb" aria-hidden />
          <span>
            Blink glowing · {xp} pull{xp === 1 ? '' : 's'}
            <span className="mix-whisper-extra"> this week</span>
          </span>
        </div>
      </div>

      <aside className="mix-glass mix-rail" aria-label="Blink">
        <div className="mix-whisper mix-whisper--rail">
          <span className="mix-whisper-orb" aria-hidden />
          <span>
            Blink glowing · {xp} pull{xp === 1 ? '' : 's'}
          </span>
        </div>
      </aside>
    </div>
  )
}
