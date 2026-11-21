import { AnimatePresence, motion } from 'framer-motion'
import type { EventCandidate } from '../types'
import { safeFormatIso } from '../lib/safeDate'

type Props = {
  open: boolean
  candidate: EventCandidate | null
  remaining: number
  pulling: boolean
  pullStatus?: string | null
  onAdd: (id: string) => void
  onSkip: (id: string) => void
  onClose: () => void
}

/**
 * Mix B — single-decision Pull sheet: one candidate, Add / Skip.
 * Shared glass language with home; Blink stays accent-only.
 */
export function PullDecisionSheet({
  open,
  candidate,
  remaining,
  pulling,
  pullStatus,
  onAdd,
  onSkip,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pull-sheet-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pull-sheet-title"
        >
          <button
            type="button"
            className="pull-sheet-backdrop"
            aria-label="Close Pull"
            onClick={onClose}
          />
          <motion.div
            className="pull-sheet"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="pull-sheet-head">
              <h2 id="pull-sheet-title">Pull</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
            <p className="pull-sheet-lead">
              One job: gather appointments from SMS, mail, notes — then decide
              once.
            </p>

            {pulling && (
              <p className="pull-status pull-status-ok" role="status">
                Scanning sources…
              </p>
            )}
            {!pulling && pullStatus && (
              <p
                className={`pull-status ${
                  /fail|error|expired|missing|not signed|connect google|sign-in|timed out/i.test(
                    pullStatus,
                  )
                    ? 'pull-status-warn'
                    : /skipped|collapsed|capped|0 new|no new/i.test(pullStatus)
                      ? 'pull-status-muted'
                      : 'pull-status-ok'
                }`}
                role="status"
              >
                {pullStatus}
              </p>
            )}

            {candidate ? (
              <section className="mix-glass pull-decision">
                <h3 className="pull-decision-label">One sheet. One decision.</h3>
                <p className="pull-decision-title">
                  {candidate.title}
                  {' — '}
                  {safeFormatIso(candidate.start, 'EEEE h:mm')}
                </p>
                <p className="pull-decision-meta">
                  From {candidate.sourceLabel}
                  {' · '}
                  {Math.round(candidate.confidence * 100)}% confidence
                  {candidate.source === 'texts' ? ' · native SMS' : ''}
                </p>
                <button
                  type="button"
                  className="btn btn-primary pull-decision-add"
                  onClick={() => onAdd(candidate.id)}
                >
                  Add to calendar
                </button>
                <button
                  type="button"
                  className="pull-decision-skip"
                  onClick={() => onSkip(candidate.id)}
                >
                  Skip · show next
                  {remaining > 1 ? ` (${remaining - 1} left)` : ''}
                </button>
              </section>
            ) : (
              <section className="mix-glass pull-decision">
                <h3 className="pull-decision-label">Inbox clear</h3>
                <p className="pull-decision-meta">
                  Nothing waiting. Connect Google or paste a capture, then Pull
                  again.
                </p>
              </section>
            )}

            <div className="pull-blink-row">
              <span className="pull-blink-orb" aria-hidden />
              <span>Blink perks up when a pull lands.</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
