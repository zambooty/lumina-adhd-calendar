import { AnimatePresence, motion } from 'framer-motion'
import type { EventCandidate } from '../types'
import { connectors } from '../connectors'
import { safeFormatIso } from '../lib/safeDate'

type Props = {
  candidates: EventCandidate[]
  pulling: boolean
  autoAdd: boolean
  pullStatus?: string | null
  onPull: () => void
  onSchedule: (id: string) => void
  onDismiss: (id: string) => void
  onToggleAutoAdd: () => void
}

export function SourceInbox({
  candidates,
  pulling,
  autoAdd,
  pullStatus,
  onPull,
  onSchedule,
  onDismiss,
  onToggleAutoAdd,
}: Props) {
  return (
    <div className="section-content">
      <div className="source-dots">
        {connectors.map((c) => (
          <span
            key={c.id}
            className="source-dot"
            style={{ borderColor: `${c.accent}55`, color: c.accent }}
          >
            {c.label}
          </span>
        ))}
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={autoAdd}
          onChange={onToggleAutoAdd}
        />
        Auto-add high-confidence (≥90%) — feels automatic
      </label>

      <div className="inbox-pull-row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onPull}
          disabled={pulling}
        >
          {pulling ? 'Pulling…' : 'Pull from sources'}
        </button>
      </div>

      {pullStatus && (
        <p
          className={`pull-status ${
            /fail|error|expired|missing/i.test(pullStatus)
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

      <AnimatePresence initial={false}>
        {candidates.length === 0 ? (
          <motion.p
            key="empty"
            className="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Inbox clear. Connect Google, then Pull to load real Calendar and
            Gmail. Notes/Texts stay empty while Google is live.
          </motion.p>
        ) : (
          candidates.map((c) => (
            <motion.div
              key={c.id}
              className="candidate"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22 }}
            >
              <div className="candidate-top">
                <div>
                  <p className="event-meta" style={{ margin: 0 }}>
                    <span style={{ color: c.color, fontWeight: 700 }}>
                      {c.sourceLabel}
                    </span>
                    {' · '}
                    {safeFormatIso(c.start, 'EEE h:mm a')}
                  </p>
                  <h3 className="event-title" style={{ marginTop: 4 }}>
                    {c.title}
                  </h3>
                </div>
                <span className="conf">
                  {Math.round(c.confidence * 100)}% match
                </span>
              </div>
              <p className="snippet">{c.rawSnippet}</p>
              <div className="candidate-actions">
                <button
                  type="button"
                  className="btn btn-coral btn-sm"
                  onClick={() => onSchedule(c.id)}
                >
                  Add to calendar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onDismiss(c.id)}
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}
