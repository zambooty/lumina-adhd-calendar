import { isToday, isTomorrow } from 'date-fns'
import { motion } from 'framer-motion'
import type { CalendarEvent, ReminderStack } from '../types'
import { formatOffset } from '../lib/reminders'
import { safeFormatIso, safeParseIso } from '../lib/safeDate'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
  onChangeStack: (eventId: string, stackId: string) => void
  onOpenEvent?: (eventId: string) => void
}

function dayLabel(iso: string): string {
  const d = safeParseIso(iso)
  if (!d) return 'Date TBD'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return safeFormatIso(iso, 'EEE · MMM d')
}

export function UpcomingList({
  events,
  stacks,
  onChangeStack,
  onOpenEvent,
}: Props) {
  if (events.length === 0) {
    return (
      <p className="empty">
        No events yet — connect Google and pull, or add from the inbox.
      </p>
    )
  }

  return (
    <>
      {events.map((event, i) => {
        const stack =
          stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0]
        const offsets = event.reminderOverride ?? stack?.offsets ?? []
        return (
          <motion.article
            key={event.id}
            className={`event-row${onOpenEvent ? ' event-row--tap' : ''}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            onClick={onOpenEvent ? () => onOpenEvent(event.id) : undefined}
            role={onOpenEvent ? 'button' : undefined}
            tabIndex={onOpenEvent ? 0 : undefined}
            onKeyDown={
              onOpenEvent
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenEvent(event.id)
                    }
                  }
                : undefined
            }
          >
            <div
              style={{
                width: 4,
                alignSelf: 'stretch',
                borderRadius: 4,
                background: event.color,
                boxShadow: `0 0 12px ${event.color}66`,
              }}
            />
            <div>
              <p className="event-meta" style={{ marginBottom: 2 }}>
                <span style={{ color: event.color, fontWeight: 700 }}>
                  {dayLabel(event.start)}
                </span>
                {' · '}
                {safeFormatIso(event.start, 'h:mm a')}
                {event.sourceLabel ? ` · ${event.sourceLabel}` : ''}
              </p>
              <h3 className="event-title">{event.title}</h3>
              {event.location && (
                <p className="event-meta">{event.location}</p>
              )}
              <div className="stack-pills">
                {offsets.map((o) => (
                  <span key={o.id} className="stack-pill">
                    {formatOffset(o.minutesBefore)} · {o.label}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="event-stack-control"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <label className="event-meta" htmlFor={`upcoming-stack-${event.id}`}>
                Stack
              </label>
              <select
                id={`upcoming-stack-${event.id}`}
                className="select"
                style={{ marginTop: 4 }}
                value={event.reminderStackId}
                onChange={(e) => onChangeStack(event.id, e.target.value)}
              >
                {stacks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </motion.article>
        )
      })}
    </>
  )
}
