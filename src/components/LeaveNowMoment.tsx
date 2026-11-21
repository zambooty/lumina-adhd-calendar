import { AnimatePresence, motion } from 'framer-motion'
import type { CalendarEvent, ReminderStack } from '../types'
import { formatOffset } from '../lib/reminders'
import { safeFormatIso } from '../lib/safeDate'

type Props = {
  open: boolean
  event: CalendarEvent | null
  stacks: ReminderStack[]
  onOpenEvent: () => void
  onDismiss: () => void
}

/**
 * Mix reminder / leave-now moment — same glass language as home.
 * One job, one CTA; Blink glow stays in chrome.
 */
export function LeaveNowMoment({
  open,
  event,
  stacks,
  onOpenEvent,
  onDismiss,
}: Props) {
  const stack =
    event &&
    (stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0])
  const offsets = event?.reminderOverride ?? stack?.offsets ?? []

  return (
    <AnimatePresence>
      {open && event && (
        <motion.div
          className="leave-moment-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-moment-title"
        >
          <button
            type="button"
            className="leave-moment-backdrop"
            aria-label="Dismiss reminder"
            onClick={onDismiss}
          />
          <motion.div
            className="leave-moment"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <section className="mix-glass leave-moment-card">
              <div className="leave-moment-app">
                <span className="leave-moment-icon" aria-hidden />
                <span className="leave-moment-brand">LUMINA</span>
                <span className="leave-moment-now">now</span>
              </div>
              <h2 id="leave-moment-title" className="leave-moment-title">
                Leave now · {event.title}
              </h2>
              <p className="leave-moment-meta">
                {safeFormatIso(event.start, 'h:mm')} appointment · travel
                buffer hit. Open Lumina for the full stack.
              </p>
              <div className="leave-moment-pills">
                {offsets.slice(0, 4).map((o) => (
                  <span
                    key={o.id}
                    className={`stack-pill${
                      /leave/i.test(o.label) ? ' stack-pill--leave' : ''
                    }`}
                  >
                    {formatOffset(o.minutesBefore)}
                    {/leave/i.test(o.label) ? '' : ' ✓'}
                    {/leave/i.test(o.label) ? ' leave-now' : ''}
                  </span>
                ))}
              </div>
            </section>

            <section className="mix-glass leave-moment-cta-card">
              <h3 className="leave-moment-cta-title">In-app reminder moment</h3>
              <p className="leave-moment-cta-meta">
                Same glass language as home: one job, one CTA. Blink glow stays
                in chrome — calendar event stays primary.
              </p>
              <button
                type="button"
                className="btn btn-primary leave-moment-cta"
                onClick={onOpenEvent}
              >
                Open event
              </button>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
