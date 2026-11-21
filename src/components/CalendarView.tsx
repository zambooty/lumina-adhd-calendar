import { isToday, isTomorrow } from 'date-fns'
import { motion } from 'framer-motion'
import type { CalendarEvent, ReminderStack } from '../types'
import { formatOffset } from '../lib/reminders'
import { safeFormatIso, safeParseIso } from '../lib/safeDate'

type Props = {
  events: CalendarEvent[]
  stacks: ReminderStack[]
  onChangeStack: (eventId: string, stackId: string) => void
}

function dayLabel(iso: string): string {
  const d = safeParseIso(iso)
  if (!d) return 'Date TBD'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return safeFormatIso(iso, 'EEE · MMM d')
}

export function CalendarView({ events, stacks, onChangeStack }: Props) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Upcoming</h2>
          <p className="panel-hint">Vivid labels · ADHD-friendly hierarchy</p>
        </div>
      </div>
      <div className="panel-body">
        {events.length === 0 ? (
          <p className="empty">No events yet — pull from sources to fill your day.</p>
        ) : (
          events.map((event, i) => {
            const stack =
              stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0]
            const offsets = event.reminderOverride ?? stack?.offsets ?? []
            return (
              <motion.article
                key={event.id}
                className="event-row"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
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
                <div className="event-stack-control">
                  <label className="event-meta" htmlFor={`stack-${event.id}`}>
                    Stack
                  </label>
                  <select
                    id={`stack-${event.id}`}
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
          })
        )}
      </div>
    </div>
  )
}
