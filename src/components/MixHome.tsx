import { useEffect, useMemo, useState } from 'react'
import {
  addDays,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  startOfWeek,
} from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import type { CalendarEvent, PetState, ReminderStack } from '../types'
import { formatOffset } from '../lib/reminders'
import { safeFormatIso, safeParseIso } from '../lib/safeDate'
import { WEEK_STARTS_ON, eventsOnDay } from '../lib/calendarGrid'
import { petXp } from '../lib/pet'
import {
  buildDayRibbon,
  leaveProgress,
  minutesUntilLeave,
  nextUpEvents,
  pickNowEvent,
  stackArmed,
} from '../lib/mixFocus'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
  pet: PetState
  onChangeStack: (eventId: string, stackId: string) => void
  focusEventId?: string | null
  onFocusConsumed?: () => void
  onOpenEvent?: (id: string) => void
}

type SheetState =
  | { kind: 'day'; day: Date }
  | { kind: 'event'; eventId: string }
  | null

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

export function MixHome({
  events,
  stacks,
  pet,
  onChangeStack,
  focusEventId,
  onFocusConsumed,
  onOpenEvent,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [sheet, setSheet] = useState<SheetState>(null)
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

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
      if (d) setWeekAnchor(d)
      setSheet({ kind: 'event', eventId: focusEventId })
    }
    onFocusConsumed?.()
  }, [focusEventId, events, onFocusConsumed])

  const nowEvent = useMemo(() => pickNowEvent(events, now), [events, now])
  const focusId = nowEvent?.id ?? null
  const ribbon = useMemo(
    () => buildDayRibbon(events, focusId, now),
    [events, focusId, now],
  )
  const nextUp = useMemo(() => nextUpEvents(events, now, 3), [events, now])
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekAnchor, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekAnchor])

  const leaveMins =
    nowEvent != null ? minutesUntilLeave(nowEvent, stacks, now) : null
  const progress =
    nowEvent != null ? leaveProgress(nowEvent, stacks, now) : 0
  const armed = nowEvent != null && stackArmed(nowEvent, stacks)
  const xp = petXp(pet)

  function openDay(day: Date) {
    setSheet({ kind: 'day', day })
  }

  function openEvent(eventId: string) {
    setSheet({ kind: 'event', eventId })
    onOpenEvent?.(eventId)
  }

  function closeSheet() {
    setSheet(null)
  }

  const leaveCopy =
    leaveMins == null
      ? null
      : leaveMins <= 0
        ? 'Leave now'
        : leaveMins === 1
          ? 'Leave in 1 minute'
          : `Leave in ${leaveMins} minutes`

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
              <div
                className="mix-progress"
                aria-hidden
              >
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

        <div className="mix-week" role="list" aria-label="This week">
          {weekDays.map((day) => {
            const count = eventsOnDay(events, day).length
            const today = isToday(day)
            const focused =
              nowEvent &&
              (() => {
                const s = safeParseIso(nowEvent.start)
                return s ? isSameDay(s, day) : false
              })()
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="listitem"
                className={`mix-day${today ? ' is-today' : ''}${
                  focused ? ' is-focus-day' : ''
                }`}
                onClick={() => openDay(day)}
                aria-label={`${format(day, 'EEEE, MMM d')}${
                  count ? `, ${count} events` : ''
                }`}
              >
                <span className="mix-day-name">
                  <span className="mix-day-name-full">
                    {format(day, 'EEE')}
                  </span>
                  <span className="mix-day-name-short">
                    {format(day, 'EEEEE')}
                  </span>
                </span>
                <span className="mix-day-num">{format(day, 'd')}</span>
                {count > 0 && <span className="mix-day-dot" aria-hidden />}
              </button>
            )
          })}
        </div>

        <div className="mix-whisper mix-whisper--mobile" aria-live="polite">
          <span className="mix-whisper-orb" aria-hidden />
          <span>
            Blink glowing · {xp} pull{xp === 1 ? '' : 's'}
            <span className="mix-whisper-extra"> this week</span>
          </span>
        </div>
      </div>

      <aside className="mix-glass mix-rail" aria-label="Next up">
        <h2 className="mix-rail-title">Next up</h2>
        <p className="mix-rail-hint">Three things. That&apos;s enough.</p>
        {nextUp.length === 0 ? (
          <p className="mix-rail-empty">Calendar clear — breathe.</p>
        ) : (
          nextUp.map((e) => (
            <button
              key={e.id}
              type="button"
              className="mix-chip"
              style={{ ['--chip-accent' as string]: e.color }}
              onClick={() => openEvent(e.id)}
            >
              <span className="mix-chip-bar" aria-hidden />
              <span className="mix-chip-body">
                <span className="mix-chip-title">{e.title}</span>
                <span className="mix-chip-meta">
                  {safeFormatIso(e.start, 'EEE h:mm')}
                </span>
              </span>
            </button>
          ))
        )}
        <div className="mix-whisper mix-whisper--rail">
          <span className="mix-whisper-orb" aria-hidden />
          <span>
            Blink glowing · {xp} pull{xp === 1 ? '' : 's'}
          </span>
        </div>
      </aside>

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
