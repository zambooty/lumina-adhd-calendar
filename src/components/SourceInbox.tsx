import { AnimatePresence, motion } from 'framer-motion'
import type { EventCandidate } from '../types'
import { sourceChips } from '../connectors'
import { safeFormatIso } from '../lib/safeDate'
import { CaptureImport } from './CaptureImport'

type Props = {
  candidates: EventCandidate[]
  pulling: boolean
  autoAdd: boolean
  pullStatus?: string | null
  onPull: () => void
  onSchedule: (id: string) => void
  onDismiss: (id: string) => void
  onToggleAutoAdd: () => void
  /** Optional toast hook after paste/upload queues items. */
  onCaptureImported?: (info: { added: number }) => void
}

/**
 * Source inbox body for the calendar-first menu shell.
 * Capture paste/upload lives here; Google connect stays in its own menu section.
 */
export function SourceInbox({
  candidates,
  pulling,
  autoAdd,
  pullStatus,
  onPull,
  onSchedule,
  onDismiss,
  onToggleAutoAdd,
  onCaptureImported,
}: Props) {
  return (
    <div className="section-content">
      <div className="source-dots">
        {sourceChips.map((c) => (
          <span
            key={`${c.id}-${c.label}`}
            className="source-dot"
            style={{ borderColor: `${c.accent}55`, color: c.accent }}
          >
            {c.label}
          </span>
        ))}
      </div>

      <CaptureImport
        onImported={(info) => {
          onCaptureImported?.(info)
        }}
      />

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
            Inbox clear. Connect Google, paste Notes/IMAP/SMS/Voicemail above,
            then Pull — live mode skips demo fillers.
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
