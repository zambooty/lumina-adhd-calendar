import { useEffect, useMemo, useState } from 'react'
import type {
  CalendarEntryKind,
  CalendarEvent,
  PetState,
  ReminderStack,
} from '../types'
import { safeFormatIso } from '../lib/safeDate'
import { petXp } from '../lib/pet'
import {
  buildDayRibbon,
  leaveProgress,
  minutesUntilLeave,
  nextUpEvents,
  pickNowEvent,
  stackArmed,
} from '../lib/mixFocus'
import { CalendarView } from './CalendarView'
import { resolveEventCategory } from '../lib/taskCategories'

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
  const nextUp = useMemo(() => nextUpEvents(events, now, 3), [events, now])

  const leaveMins =
    nowEvent != null ? minutesUntilLeave(nowEvent, stacks, now) : null
  const progress =
    nowEvent != null ? leaveProgress(nowEvent, stacks, now) : 0
  const armed = nowEvent != null && stackArmed(nowEvent, stacks)
  const xp = petXp(pet)

  const leaveCopy =
    leaveMins == null
      ? null
      : leaveMins <= 0
        ? 'Leave now'
        : leaveMins === 1
          ? 'Leave in 1 minute'
          : leaveMins >= 60
            ? `Leave in ${Math.round(leaveMins / 60)}hr`
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
                onClick={() => onOpenEvent?.(nowEvent.id)}
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
              onClick={() => block.eventId && onOpenEvent?.(block.eventId)}
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
          nextUp.map((e) => {
            const color = resolveEventCategory(e).color
            return (
              <button
                key={e.id}
                type="button"
                className="mix-chip"
                style={{ ['--chip-accent' as string]: color }}
                onClick={() => onOpenEvent?.(e.id)}
              >
                <span className="mix-chip-bar" aria-hidden />
                <span className="mix-chip-body">
                  <span className="mix-chip-title">{e.title}</span>
                  <span className="mix-chip-meta">
                    {safeFormatIso(e.start, 'EEE h:mm')}
                  </span>
                </span>
              </button>
            )
          })
        )}
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
