import { useEffect, useMemo, useState } from 'react'
import type {
  CalendarEntryKind,
  CalendarEvent,
  PetState,
  ReminderStack,
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
import { CalendarView } from './CalendarView'
import { UpcomingList } from './UpcomingList'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
  pet: PetState
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
}

export function MixHome({
  events,
  stacks,
  pet,
  onChangeStack,
  onChangeCategory,
  onAddEntry,
  focusEventId,
  onFocusConsumed,
  onOpenEvent,
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
