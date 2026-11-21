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
  /** Open fullscreen Mix Pull sheet (preferred decision surface). */
  onOpenPullSheet?: () => void
}

/**
 * Source inbox — capture + settings. Decisions prefer the Mix single-sheet;
 * first pending candidate is shown here as a compact decision card too.
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
  onOpenPullSheet,
}: Props) {
  const lead = candidates[0] ?? null
  const remaining = candidates.length

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
          onClick={() => {
            onPull()
            onOpenPullSheet?.()
          }}
          disabled={pulling}
        >
          {pulling ? 'Pulling…' : 'Pull from sources'}
        </button>
        {remaining > 0 && onOpenPullSheet && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onOpenPullSheet}
          >
            Open decision sheet
          </button>
        )}
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

      <AnimatePresence initial={false} mode="wait">
        {lead ? (
          <motion.section
            key={lead.id}
            className="mix-glass pull-decision pull-decision--inbox"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22 }}
          >
            <h3 className="pull-decision-label">One sheet. One decision.</h3>
            <p className="pull-decision-title">
              {lead.title}
              {' — '}
              {safeFormatIso(lead.start, 'EEEE h:mm')}
            </p>
            <p className="pull-decision-meta">
              From {lead.sourceLabel}
              {' · '}
              {Math.round(lead.confidence * 100)}% confidence
              {remaining > 1 ? ` · ${remaining - 1} more after this` : ''}
            </p>
            <button
              type="button"
              className="btn btn-primary pull-decision-add"
              onClick={() => onSchedule(lead.id)}
            >
              Add to calendar
            </button>
            <button
              type="button"
              className="pull-decision-skip"
              onClick={() => onDismiss(lead.id)}
            >
              Skip · show next
            </button>
          </motion.section>
        ) : (
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
        )}
      </AnimatePresence>
    </div>
  )
}
