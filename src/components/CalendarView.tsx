import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isSameMonth,
  isToday,
  isTomorrow,
  setHours,
  setMinutes,
  startOfWeek,
} from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  CalendarEntryKind,
  CalendarEvent,
  ReminderStack,
} from '../types'
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
  yearMonths,
} from '../lib/calendarGrid'
import {
  DEFAULT_CATEGORY_ID,
  MANUAL_ENTRY_KINDS,
  TASK_CATEGORIES,
  type ManualEntryKind,
  type TaskCategoryId,
  categoryById,
  resolveEventCategory,
} from '../lib/taskCategories'

export type CalendarViewMode = 'week' | 'month' | 'year'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
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
  /** Open a specific event detail sheet (e.g. from menu upcoming list). */
  focusEventId?: string | null
  onFocusConsumed?: () => void
}

type SheetState =
  | { kind: 'day'; day: Date }
  | { kind: 'event'; eventId: string }
  | {
      kind: 'add'
      day: Date
      entryKind?: ManualEntryKind
    }
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
  { id: 'year', label: 'Year' },
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

function eventDisplayColor(event: CalendarEvent): string {
  return resolveEventCategory(event).color
}

function defaultTimesForKind(
  day: Date,
  kind: ManualEntryKind,
): { start: Date; end: Date } {
  const base = setMinutes(setHours(day, kind === 'note' ? 9 : 10), 0)
  if (kind === 'note') {
    return { start: base, end: setMinutes(base, 15) }
  }
  if (kind === 'reminder') {
    return { start: base, end: setMinutes(base, 15) }
  }
  return { start: base, end: setHours(base, 11) }
}

function toTimeInputValue(d: Date): string {
  return format(d, 'HH:mm')
}

function applyTimeOnDay(day: Date, time: string): Date {
  const [h, m] = time.split(':').map((n) => Number(n))
  return setMinutes(setHours(day, Number.isFinite(h) ? h : 10), Number.isFinite(m) ? m : 0)
}

export function CalendarView({
  events,
  stacks,
  onChangeStack,
  onChangeCategory,
  onAddEntry,
  focusEventId,
  onFocusConsumed,
}: Props) {
  const [mode, setMode] = useState<CalendarViewMode>('month')
  const [cursor, setCursor] = useState(() => new Date())
  const [sheet, setSheet] = useState<SheetState>(null)
  const [legendFilter, setLegendFilter] = useState<TaskCategoryId | 'all'>(
    'all',
  )

  const visibleEvents = useMemo(() => {
    if (legendFilter === 'all') return events
    return events.filter((e) => resolveEventCategory(e).id === legendFilter)
  }, [events, legendFilter])

  const selectedEvent = useMemo(() => {
    if (sheet?.kind !== 'event') return null
    return events.find((e) => e.id === sheet.eventId) ?? null
  }, [sheet, events])

  const dayEvents = useMemo(() => {
    if (sheet?.kind === 'day' || sheet?.kind === 'add') {
      return eventsOnDay(visibleEvents, sheet.day)
    }
    if (sheet?.kind === 'event' && selectedEvent) {
      const d = safeParseIso(selectedEvent.start)
      return d ? eventsOnDay(visibleEvents, d) : []
    }
    return []
  }, [sheet, visibleEvents, selectedEvent])

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

  function openAdd(day: Date, entryKind?: ManualEntryKind) {
    setSheet({ kind: 'add', day, entryKind })
  }

  function closeSheet() {
    setSheet(null)
  }

  function stepCursor(dir: -1 | 1) {
    setCursor((c) => {
      if (mode === 'year') return addYears(c, dir)
      if (mode === 'month') return addMonths(c, dir)
      return addWeeks(c, dir)
    })
  }

  const headerTitle =
    mode === 'year'
      ? format(cursor, 'yyyy')
      : mode === 'month'
        ? format(cursor, 'MMMM yyyy')
        : (() => {
            const days = weekDays(cursor)
            return `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d')}`
          })()

  return (
    <div className="calendar-primary">
      <div className="cal-toolbar">
        <div className="cal-tabs cal-tabs--3" role="tablist" aria-label="Calendar view">
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
            onClick={() => stepCursor(-1)}
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
            onClick={() => stepCursor(1)}
          >
            ›
          </button>
        </div>

        <div className="cal-legend" role="list" aria-label="Task color categories">
          <button
            type="button"
            role="listitem"
            className={`cal-legend-chip${legendFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => setLegendFilter('all')}
          >
            All
          </button>
          {TASK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="listitem"
              className={`cal-legend-chip${legendFilter === cat.id ? ' is-active' : ''}`}
              style={{
                ['--cat-color' as string]: cat.color,
              }}
              onClick={() =>
                setLegendFilter((prev) => (prev === cat.id ? 'all' : cat.id))
              }
              title={cat.label}
            >
              <span className="cal-legend-dot" aria-hidden />
              {cat.short}
            </button>
          ))}
        </div>
      </div>

      <div className="cal-body" role="tabpanel">
        {mode === 'month' ? (
          <MonthGrid
            cursor={cursor}
            events={visibleEvents}
            onOpenDay={openDay}
            onOpenEvent={openEvent}
          />
        ) : mode === 'week' ? (
          <WeekGrid
            cursor={cursor}
            events={visibleEvents}
            onOpenDay={openDay}
            onOpenEvent={openEvent}
          />
        ) : (
          <YearGrid
            cursor={cursor}
            events={visibleEvents}
            onOpenMonth={(month) => {
              setCursor(month)
              setMode('month')
            }}
            onOpenDay={openDay}
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
            onChangeCategory={onChangeCategory}
            onAddEntry={onAddEntry}
            onOpenEvent={openEvent}
            onOpenAdd={openAdd}
            onBackToDay={() => {
              if (sheet.kind === 'add') {
                setSheet({ kind: 'day', day: sheet.day })
                return
              }
              if (selectedEvent) {
                const d = safeParseIso(selectedEvent.start)
                if (d) setSheet({ kind: 'day', day: d })
                else closeSheet()
              }
            }}
            onSelectEntryKind={(kind) => {
              if (sheet.kind === 'add' || sheet.kind === 'day') {
                const day = sheet.day
                setSheet({ kind: 'add', day, entryKind: kind })
              }
            }}
            onClose={closeSheet}
            onAdded={(eventId) => {
              setSheet({ kind: 'event', eventId })
            }}
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
                {shown.map((e) => {
                  const color = eventDisplayColor(e)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="month-chip"
                      style={{
                        background: `${color}22`,
                        borderColor: `${color}88`,
                        color,
                      }}
                      onClick={() => onOpenEvent(e.id)}
                    >
                      {e.title}
                    </button>
                  )
                })}
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
                const color = eventDisplayColor(event)
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="week-event"
                    style={{
                      top: `${layout.topPct}%`,
                      height: `${layout.heightPct}%`,
                      background: `${color}33`,
                      borderColor: color,
                      color,
                      boxShadow: `0 0 14px ${color}44`,
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

function YearGrid({
  cursor,
  events,
  onOpenMonth,
  onOpenDay,
}: {
  cursor: Date
  events: CalendarEvent[]
  onOpenMonth: (month: Date) => void
  onOpenDay: (day: Date) => void
}) {
  const months = useMemo(() => yearMonths(cursor), [cursor])

  return (
    <div className="year-grid" aria-label={`${format(cursor, 'yyyy')} overview`}>
      {months.map((month) => {
        const days = monthMatrix(month)
        const weekHead = weekDays(month).slice(0, 7)
        return (
          <section key={month.toISOString()} className="year-month">
            <button
              type="button"
              className="year-month-title"
              onClick={() => onOpenMonth(month)}
            >
              {format(month, 'MMM')}
            </button>
            <div className="year-weekdays" aria-hidden>
              {weekHead.map((d) => (
                <span key={d.toISOString()}>{format(d, 'EEEEE')}</span>
              ))}
            </div>
            <div className="year-cells">
              {days.map((day) => {
                const outside = !isSameMonth(day, month)
                const count = outside ? 0 : eventsOnDay(events, day).length
                const today = isToday(day)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={outside}
                    className={`year-cell${outside ? ' is-outside' : ''}${today ? ' is-today' : ''}${count ? ' has-events' : ''}`}
                    onClick={() => onOpenDay(day)}
                    aria-label={
                      outside
                        ? undefined
                        : `${format(day, 'EEEE, MMM d')}${count ? `, ${count} events` : ''}`
                    }
                  >
                    <span>{format(day, 'd')}</span>
                    {count > 0 && (
                      <span className="year-cell-dots" aria-hidden>
                        {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function DetailSheet({
  sheet,
  dayEvents,
  selectedEvent,
  stacks,
  onChangeStack,
  onChangeCategory,
  onAddEntry,
  onOpenEvent,
  onOpenAdd,
  onBackToDay,
  onSelectEntryKind,
  onClose,
  onAdded,
}: {
  sheet: Exclude<SheetState, null>
  dayEvents: CalendarEvent[]
  selectedEvent: CalendarEvent | null
  stacks: ReminderStack[]
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
  onOpenEvent: (id: string) => void
  onOpenAdd: (day: Date, entryKind?: ManualEntryKind) => void
  onBackToDay: () => void
  onSelectEntryKind: (kind: ManualEntryKind) => void
  onClose: () => void
  onAdded: (eventId: string) => void
}) {
  const isEvent = sheet.kind === 'event' && selectedEvent
  const isAdd = sheet.kind === 'add'
  const day =
    sheet.kind === 'day' || sheet.kind === 'add' ? sheet.day : null
  const stack = selectedEvent ? stackFor(selectedEvent, stacks) : undefined
  const offsets = selectedEvent?.reminderOverride ?? stack?.offsets ?? []
  const selectedCat = selectedEvent
    ? resolveEventCategory(selectedEvent)
    : null

  return (
    <motion.div
      className="cal-sheet-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cal-sheet mix-glass-sheet"
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
          {isEvent || isAdd ? (
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
              style={{ color: selectedCat?.color, fontWeight: 700 }}
            >
              {dayLabel(selectedEvent.start)} ·{' '}
              {safeFormatIso(selectedEvent.start, 'h:mm a')}
              {' – '}
              {safeFormatIso(selectedEvent.end, 'h:mm a')}
              {selectedEvent.entryKind === 'note'
                ? ' · Note'
                : selectedEvent.entryKind === 'reminder'
                  ? ' · Reminder'
                  : ''}
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

            {onChangeCategory && (
              <div className="section-gap">
                <p className="event-meta" id="cat-picker-label">
                  Color category
                </p>
                <div
                  className="cal-cat-picker"
                  role="group"
                  aria-labelledby="cat-picker-label"
                >
                  {TASK_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`cal-cat-swatch${selectedCat?.id === cat.id ? ' is-active' : ''}`}
                      style={{ ['--cat-color' as string]: cat.color }}
                      aria-pressed={selectedCat?.id === cat.id}
                      aria-label={cat.label}
                      title={cat.label}
                      onClick={() => onChangeCategory(selectedEvent.id, cat.id)}
                    >
                      <span className="cal-cat-swatch-dot" aria-hidden />
                      <span className="cal-cat-swatch-label">{cat.short}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                  <span
                    key={o.id}
                    className={`stack-pill${
                      /leave/i.test(o.label) ? ' stack-pill--leave' : ''
                    }`}
                  >
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
                      style={{ borderLeftColor: eventDisplayColor(e) }}
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
        ) : isAdd && day ? (
          <AddEntryForm
            day={day}
            initialKind={sheet.entryKind}
            onSelectKind={onSelectEntryKind}
            onAddEntry={onAddEntry}
            onCancel={onBackToDay}
            onAdded={onAdded}
          />
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
                : `${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'}`}
            </p>

            {onAddEntry && (
              <button
                type="button"
                className="btn btn-primary cal-day-add"
                onClick={() => onOpenAdd(day)}
              >
                + Add event, reminder, or note
              </button>
            )}

            {dayEvents.length === 0 ? (
              <p className="empty">No items on this day.</p>
            ) : (
              dayEvents.map((e) => {
                const s = stackFor(e, stacks)
                const offs = e.reminderOverride ?? s?.offsets ?? []
                const color = eventDisplayColor(e)
                return (
                  <button
                    key={e.id}
                    type="button"
                    className="cal-day-event"
                    style={{ borderLeftColor: color }}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <span
                      className="event-meta"
                      style={{ color, fontWeight: 700 }}
                    >
                      {safeFormatIso(e.start, 'h:mm a')}
                      {' – '}
                      {safeFormatIso(e.end, 'h:mm a')}
                      {e.entryKind === 'note'
                        ? ' · Note'
                        : e.entryKind === 'reminder'
                          ? ' · Reminder'
                          : ''}
                    </span>
                    <span className="event-title">{e.title}</span>
                    {e.location && (
                      <span className="event-meta">{e.location}</span>
                    )}
                    <span className="stack-pills">
                      {offs.slice(0, 3).map((o) => (
                        <span
                          key={o.id}
                          className={`stack-pill${
                            /leave/i.test(o.label) ? ' stack-pill--leave' : ''
                          }`}
                        >
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

function AddEntryForm({
  day,
  initialKind,
  onSelectKind,
  onAddEntry,
  onCancel,
  onAdded,
}: {
  day: Date
  initialKind?: ManualEntryKind
  onSelectKind: (kind: ManualEntryKind) => void
  onAddEntry?: (input: {
    title: string
    start: string
    end: string
    kind: CalendarEntryKind
    categoryId?: string
    notes?: string
  }) => string
  onCancel: () => void
  onAdded: (eventId: string) => void
}) {
  const kind = initialKind
  const defaults = kind ? defaultTimesForKind(day, kind) : null
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState<TaskCategoryId>(
    DEFAULT_CATEGORY_ID,
  )
  const [startTime, setStartTime] = useState(
    defaults ? toTimeInputValue(defaults.start) : '10:00',
  )
  const [endTime, setEndTime] = useState(
    defaults ? toTimeInputValue(defaults.end) : '11:00',
  )

  useEffect(() => {
    if (!kind) return
    const next = defaultTimesForKind(day, kind)
    setStartTime(toTimeInputValue(next.start))
    setEndTime(toTimeInputValue(next.end))
  }, [kind, day])

  if (!kind) {
    return (
      <div className="cal-sheet-body">
        <h3 id="cal-sheet-title" className="cal-sheet-title">
          Add to {format(day, 'MMM d')}
        </h3>
        <p className="panel-hint" style={{ marginTop: 4 }}>
          Pick one — keeps the day calm.
        </p>
        <div className="cal-add-kinds">
          {MANUAL_ENTRY_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="cal-add-kind"
              onClick={() => onSelectKind(k.id)}
            >
              <span className="cal-add-kind-label">{k.label}</span>
              <span className="cal-add-kind-hint">{k.hint}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 12 }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    )
  }

  const entryKind: ManualEntryKind = kind
  const kindMeta = MANUAL_ENTRY_KINDS.find((k) => k.id === entryKind)!

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!onAddEntry) return
    let start = applyTimeOnDay(day, startTime)
    let end = applyTimeOnDay(day, endTime)
    if (end <= start) {
      end = new Date(
        start.getTime() + (entryKind === 'event' ? 60 : 15) * 60_000,
      )
    }
    const id = onAddEntry({
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      kind: entryKind,
      categoryId,
      notes: notes.trim() || undefined,
    })
    onAdded(id)
  }

  return (
    <form className="cal-sheet-body" onSubmit={submit}>
      <h3 id="cal-sheet-title" className="cal-sheet-title">
        New {kindMeta.label.toLowerCase()}
      </h3>
      <p className="panel-hint" style={{ marginTop: 4 }}>
        {format(day, 'EEEE · MMM d')} · {kindMeta.hint}
      </p>

      <label className="event-meta" htmlFor="cal-add-title">
        Title
      </label>
      <input
        id="cal-add-title"
        className="input cal-add-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          kind === 'note'
            ? 'What’s on your mind?'
            : kind === 'reminder'
              ? 'What should ping you?'
              : 'What’s happening?'
        }
        autoFocus
      />

      {entryKind !== 'note' && (
        <div className="cal-add-times">
          <div>
            <label className="event-meta" htmlFor="cal-add-start">
              Starts
            </label>
            <input
              id="cal-add-start"
              type="time"
              className="input cal-add-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          {entryKind === 'event' && (
            <div>
              <label className="event-meta" htmlFor="cal-add-end">
                Ends
              </label>
              <input
                id="cal-add-end"
                type="time"
                className="input cal-add-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {entryKind === 'note' && (
        <>
          <label className="event-meta" htmlFor="cal-add-notes">
            Note
          </label>
          <textarea
            id="cal-add-notes"
            className="input cal-add-input cal-add-textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Park it here — no pressure."
          />
        </>
      )}

      <p className="event-meta" id="cal-add-cat-label">
        Color category
      </p>
      <div
        className="cal-cat-picker"
        role="group"
        aria-labelledby="cal-add-cat-label"
      >
        {TASK_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`cal-cat-swatch${categoryId === cat.id ? ' is-active' : ''}`}
            style={{ ['--cat-color' as string]: cat.color }}
            aria-pressed={categoryId === cat.id}
            aria-label={cat.label}
            onClick={() => setCategoryId(cat.id)}
          >
            <span className="cal-cat-swatch-dot" aria-hidden />
            <span className="cal-cat-swatch-label">{cat.short}</span>
          </button>
        ))}
      </div>

      <div className="cal-add-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Back
        </button>
        <button type="submit" className="btn btn-primary" disabled={!onAddEntry}>
          Save {kindMeta.label.toLowerCase()}
        </button>
      </div>
      <p className="cal-add-cat-hint">
        Category: {categoryById(categoryId).label}
      </p>
    </form>
  )
}
