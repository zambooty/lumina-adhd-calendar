import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isToday,
  isTomorrow,
  startOfWeek,
} from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import type { CalendarEvent, ReminderStack } from '../types'
import { formatOffset } from '../lib/reminders'
import { safeFormatIso, safeParseIso } from '../lib/safeDate'
import {
  WEEK_STARTS_ON,
  eventLayoutInDay,
  eventsInRange,
  eventsOnDay,
  isOutsideMonth,
  monthMatrix,
  weekDays,
} from '../lib/calendarGrid'

export type CalendarViewMode = 'week' | 'month'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
  onChangeStack: (eventId: string, stackId: string) => void
  /** Open a specific event detail sheet (e.g. from menu upcoming list). */
  focusEventId?: string | null
  onFocusConsumed?: () => void
}

type SheetState =
  | { kind: 'day'; day: Date }
  | { kind: 'event'; eventId: string }
  | null

const DAY_START_HOUR = 6
const DAY_END_HOUR = 22
const HOUR_LABELS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
)

const VIEW_MODES: { id: CalendarViewMode; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

function dayLabel(iso: string): string {
  const d = safeParseIso(iso)
  if (!d) return 'Date TBD'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return safeFormatIso(iso, 'EEE · MMM d')
}

function stackFor(
  event: CalendarEvent,
  stacks: ReminderStack[],
): ReminderStack | undefined {
  return stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0]
}

export function CalendarView({
  events,
  stacks,
  onChangeStack,
  focusEventId,
  onFocusConsumed,
}: Props) {
  const [mode, setMode] = useState<CalendarViewMode>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [sheet, setSheet] = useState<SheetState>(null)

  const selectedEvent = useMemo(() => {
    if (sheet?.kind !== 'event') return null
    return events.find((e) => e.id === sheet.eventId) ?? null
  }, [sheet, events])

  const dayEvents = useMemo(() => {
    if (sheet?.kind === 'day') return eventsOnDay(events, sheet.day)
    if (sheet?.kind === 'event' && selectedEvent) {
      const d = safeParseIso(selectedEvent.start)
      return d ? eventsOnDay(events, d) : []
    }
    return []
  }, [sheet, events, selectedEvent])

  useEffect(() => {
    if (!focusEventId) return
    const event = events.find((e) => e.id === focusEventId)
    if (event) {
      const d = safeParseIso(event.start)
      if (d) setCursor(d)
      setSheet({ kind: 'event', eventId: focusEventId })
    }
    onFocusConsumed?.()
  }, [focusEventId, events, onFocusConsumed])

  function openDay(day: Date) {
    setSheet({ kind: 'day', day })
  }

  function openEvent(eventId: string) {
    setSheet({ kind: 'event', eventId })
  }

  function closeSheet() {
    setSheet(null)
  }

  const headerTitle =
    mode === 'month'
      ? format(cursor, 'MMMM yyyy')
      : (() => {
          const days = weekDays(cursor)
          return `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d')}`
        })()

  return (
    <div className="calendar-primary">
      <div className="cal-toolbar">
        <div className="cal-tabs" role="tablist" aria-label="Calendar view">
          {VIEW_MODES.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={mode === v.id}
              className={`cal-tab${mode === v.id ? ' is-active' : ''}`}
              onClick={() => setMode(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="cal-nav">
          <button
            type="button"
            className="btn btn-ghost btn-sm cal-nav-btn"
            aria-label="Previous"
            onClick={() =>
              setCursor((c) =>
                mode === 'month' ? addMonths(c, -1) : addWeeks(c, -1),
              )
            }
          >
            ‹
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm cal-nav-today"
            onClick={() => setCursor(new Date())}
          >
            Today
          </button>
          <p className="cal-nav-label">{headerTitle}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm cal-nav-btn"
            aria-label="Next"
            onClick={() =>
              setCursor((c) =>
                mode === 'month' ? addMonths(c, 1) : addWeeks(c, 1),
              )
            }
          >
            ›
          </button>
        </div>
      </div>

      <div className="cal-body" role="tabpanel">
        {mode === 'month' ? (
          <MonthGrid
            cursor={cursor}
            events={events}
            onOpenDay={openDay}
            onOpenEvent={openEvent}
          />
        ) : (
          <WeekGrid
            cursor={cursor}
            events={events}
            onOpenDay={openDay}
            onOpenEvent={openEvent}
          />
        )}
      </div>

      <AnimatePresence>
        {sheet && (
          <DetailSheet
            sheet={sheet}
            dayEvents={dayEvents}
            selectedEvent={selectedEvent}
            stacks={stacks}
            onChangeStack={onChangeStack}
            onOpenEvent={openEvent}
            onBackToDay={() => {
              if (selectedEvent) {
                const d = safeParseIso(selectedEvent.start)
                if (d) setSheet({ kind: 'day', day: d })
                else closeSheet()
              }
            }}
            onClose={closeSheet}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function MonthGrid({
  cursor,
  events,
  onOpenDay,
  onOpenEvent,
}: {
  cursor: Date
  events: CalendarEvent[]
  onOpenDay: (day: Date) => void
  onOpenEvent: (id: string) => void
}) {
  const days = useMemo(() => monthMatrix(cursor), [cursor])
  const weekHead = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [cursor])

  return (
    <div className="month-grid">
      <div className="month-weekdays" aria-hidden>
        {weekHead.map((d) => (
          <span key={d.toISOString()} className="month-weekday">
            {format(d, 'EEEEE')}
          </span>
        ))}
      </div>
      <div className="month-cells">
        {days.map((day) => {
          const dayEvts = eventsOnDay(events, day)
          const outside = isOutsideMonth(day, cursor)
          const today = isToday(day)
          const shown = dayEvts.slice(0, 3)
          const extra = dayEvts.length - shown.length
          return (
            <div
              key={day.toISOString()}
              className={`month-cell${outside ? ' is-outside' : ''}${today ? ' is-today' : ''}${dayEvts.length ? ' has-events' : ''}`}
            >
              <button
                type="button"
                className="month-cell-hit"
                onClick={() => onOpenDay(day)}
                aria-label={`${format(day, 'EEEE, MMM d')}${dayEvts.length ? `, ${dayEvts.length} events` : ''}`}
              >
                <span className="month-daynum">{format(day, 'd')}</span>
              </button>
              <div className="month-dots">
                {shown.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="month-chip"
                    style={{
                      background: `${e.color}22`,
                      borderColor: `${e.color}88`,
                      color: e.color,
                    }}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    {e.title}
                  </button>
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    className="month-more"
                    onClick={() => onOpenDay(day)}
                  >
                    +{extra} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({
  cursor,
  events,
  onOpenDay,
  onOpenEvent,
}: {
  cursor: Date
  events: CalendarEvent[]
  onOpenDay: (day: Date) => void
  onOpenEvent: (id: string) => void
}) {
  const days = useMemo(() => weekDays(cursor), [cursor])
  const rangeEvents = useMemo(
    () => eventsInRange(events, days[0], days[6]),
    [events, days],
  )
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = wrapRef.current?.querySelector(
      '.week-col.is-today, .week-dayhead.is-today',
    )
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [cursor])

  return (
    <div className="week-grid-wrap" ref={wrapRef}>
      <div className="week-grid">
        <div className="week-corner" aria-hidden />
        {days.map((day) => {
          const count = eventsOnDay(rangeEvents, day).length
          return (
            <button
              key={`head-${day.toISOString()}`}
              type="button"
              className={`week-dayhead${isToday(day) ? ' is-today' : ''}`}
              onClick={() => onOpenDay(day)}
            >
              <span className="week-dayname">{format(day, 'EEE')}</span>
              <span className="week-daynum">{format(day, 'd')}</span>
              {count > 0 && <span className="week-daycount">{count}</span>}
            </button>
          )
        })}

        <div className="week-hours" aria-hidden>
          {HOUR_LABELS.map((h) => (
            <div key={h} className="week-hour-label">
              {format(new Date(2000, 0, 1, h), 'ha')}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayEvts = eventsOnDay(rangeEvents, day)
          return (
            <div
              key={`col-${day.toISOString()}`}
              className={`week-col${isToday(day) ? ' is-today' : ''}`}
            >
              {HOUR_LABELS.map((h) => (
                <div key={h} className="week-slot" />
              ))}
              {dayEvts.map((event) => {
                const layout = eventLayoutInDay(
                  event,
                  day,
                  DAY_START_HOUR,
                  DAY_END_HOUR,
                )
                if (!layout) return null
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="week-event"
                    style={{
                      top: `${layout.topPct}%`,
                      height: `${layout.heightPct}%`,
                      background: `${event.color}33`,
                      borderColor: event.color,
                      color: event.color,
                      boxShadow: `0 0 14px ${event.color}44`,
                    }}
                    onClick={() => onOpenEvent(event.id)}
                    title={event.title}
                  >
                    <span className="week-event-time">
                      {safeFormatIso(event.start, 'h:mm')}
                    </span>
                    <span className="week-event-title">{event.title}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DetailSheet({
  sheet,
  dayEvents,
  selectedEvent,
  stacks,
  onChangeStack,
  onOpenEvent,
  onBackToDay,
  onClose,
}: {
  sheet: Exclude<SheetState, null>
  dayEvents: CalendarEvent[]
  selectedEvent: CalendarEvent | null
  stacks: ReminderStack[]
  onChangeStack: (eventId: string, stackId: string) => void
  onOpenEvent: (id: string) => void
  onBackToDay: () => void
  onClose: () => void
}) {
  const isEvent = sheet.kind === 'event' && selectedEvent
  const day = sheet.kind === 'day' ? sheet.day : null
  const stack = selectedEvent ? stackFor(selectedEvent, stacks) : undefined
  const offsets = selectedEvent?.reminderOverride ?? stack?.offsets ?? []

  return (
    <motion.div
      className="cal-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-sheet-title"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '40%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cal-sheet-handle" aria-hidden />
        <div className="cal-sheet-top">
          {isEvent ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onBackToDay}
            >
              ← Day
            </button>
          ) : (
            <span className="cal-sheet-spacer" />
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {isEvent && selectedEvent ? (
          <div className="cal-sheet-body">
            <p
              className="event-meta"
              style={{ color: selectedEvent.color, fontWeight: 700 }}
            >
              {dayLabel(selectedEvent.start)} ·{' '}
              {safeFormatIso(selectedEvent.start, 'h:mm a')}
              {' – '}
              {safeFormatIso(selectedEvent.end, 'h:mm a')}
            </p>
            <h3 id="cal-sheet-title" className="cal-sheet-title">
              {selectedEvent.title}
            </h3>
            {selectedEvent.location && (
              <p className="event-meta">{selectedEvent.location}</p>
            )}
            {selectedEvent.sourceLabel && (
              <p className="event-meta">{selectedEvent.sourceLabel}</p>
            )}
            {selectedEvent.notes && (
              <p className="snippet">{selectedEvent.notes}</p>
            )}

            <div className="section-gap">
              <label
                className="event-meta"
                htmlFor={`sheet-stack-${selectedEvent.id}`}
              >
                Reminder stack
              </label>
              <select
                id={`sheet-stack-${selectedEvent.id}`}
                className="select"
                style={{ marginTop: 6 }}
                value={selectedEvent.reminderStackId}
                onChange={(e) =>
                  onChangeStack(selectedEvent.id, e.target.value)
                }
              >
                {stacks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="stack-pills" style={{ marginTop: 10 }}>
                {offsets.map((o) => (
                  <span key={o.id} className="stack-pill">
                    {formatOffset(o.minutesBefore)} · {o.label}
                  </span>
                ))}
              </div>
            </div>

            {dayEvents.length > 1 && (
              <div className="section-gap">
                <p className="event-meta">Also this day</p>
                {dayEvents
                  .filter((e) => e.id !== selectedEvent.id)
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="cal-day-event"
                      style={{ borderLeftColor: e.color }}
                      onClick={() => onOpenEvent(e.id)}
                    >
                      <span className="event-meta">
                        {safeFormatIso(e.start, 'h:mm a')}
                      </span>
                      <span className="event-title">{e.title}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        ) : day ? (
          <div className="cal-sheet-body">
            <h3 id="cal-sheet-title" className="cal-sheet-title">
              {isToday(day)
                ? 'Today'
                : isTomorrow(day)
                  ? 'Tomorrow'
                  : format(day, 'EEEE · MMM d')}
            </h3>
            <p className="panel-hint" style={{ marginTop: 4 }}>
              {dayEvents.length === 0
                ? 'Nothing scheduled — breathe.'
                : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
            </p>
            {dayEvents.length === 0 ? (
              <p className="empty">No events on this day.</p>
            ) : (
              dayEvents.map((e) => {
                const s = stackFor(e, stacks)
                const offs = e.reminderOverride ?? s?.offsets ?? []
                return (
                  <button
                    key={e.id}
                    type="button"
                    className="cal-day-event"
                    style={{ borderLeftColor: e.color }}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <span
                      className="event-meta"
                      style={{ color: e.color, fontWeight: 700 }}
                    >
                      {safeFormatIso(e.start, 'h:mm a')}
                      {' – '}
                      {safeFormatIso(e.end, 'h:mm a')}
                    </span>
                    <span className="event-title">{e.title}</span>
                    {e.location && (
                      <span className="event-meta">{e.location}</span>
                    )}
                    <span className="stack-pills">
                      {offs.slice(0, 3).map((o) => (
                        <span key={o.id} className="stack-pill">
                          {formatOffset(o.minutesBefore)} · {o.label}
                        </span>
                      ))}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        ) : (
          <div className="cal-sheet-body">
            <p className="empty">Event not found.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
