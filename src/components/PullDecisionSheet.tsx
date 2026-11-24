import { AnimatePresence, motion, type PanInfo, useMotionValue, useTransform } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'
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

const SWIPE_THRESHOLD = 110
const SWIPE_VELOCITY = 650

/** Short ADHD-friendly status — drop essay-length not-signed-in copy. */
function shortPullStatus(status: string): string {
  const s = status.trim()
  if (/not signed in/i.test(s)) {
    const head = s.split(/·\s*Not signed/i)[0]?.trim()
    return head
      ? `${head.replace(/\.\s*$/, '')} · Not signed in — Menu → Google`
      : 'Not signed in — Menu → Google'
  }
  if (s.length <= 96) return s
  return `${s.slice(0, 93).trimEnd()}…`
}

/**
 * Mix B — single-decision Pull sheet: one candidate, swipe or Add / Deny.
 * Right = add, left = deny. Buttons + keyboard stay for accessibility.
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
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 0, 220], [-12, 0, 12])
  const addOpacity = useTransform(x, [0, 80, 160], [0, 0.55, 1])
  const denyOpacity = useTransform(x, [-160, -80, 0], [1, 0.55, 0])
  const decidedRef = useRef(false)

  const resetCard = useCallback(() => {
    x.set(0)
    decidedRef.current = false
  }, [x])

  useEffect(() => {
    resetCard()
  }, [candidate?.id, open, resetCard])

  const decide = useCallback(
    (action: 'add' | 'deny') => {
      if (!candidate || decidedRef.current) return
      decidedRef.current = true
      if (action === 'add') onAdd(candidate.id)
      else onSkip(candidate.id)
    },
    [candidate, onAdd, onSkip],
  )

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!candidate) return
      const { offset, velocity } = info
      const goRight =
        offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY
      const goLeft =
        offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY
      if (goRight) {
        decide('add')
        return
      }
      if (goLeft) {
        decide('deny')
        return
      }
      x.set(0)
    },
    [candidate, decide, x],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (!candidate) return
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        decide('add')
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault()
        decide('deny')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, candidate, decide, onClose])

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
              Swipe right to add · left to deny
            </p>

            {pulling && (
              <p className="pull-status pull-status-ok" role="status">
                Scanning…
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
                {shortPullStatus(pullStatus)}
              </p>
            )}

            {candidate ? (
              <div className="pull-swipe-stage">
                <motion.div
                  className="pull-swipe-hint pull-swipe-hint--deny"
                  style={{ opacity: denyOpacity }}
                  aria-hidden
                >
                  Deny
                </motion.div>
                <motion.div
                  className="pull-swipe-hint pull-swipe-hint--add"
                  style={{ opacity: addOpacity }}
                  aria-hidden
                >
                  Add
                </motion.div>

                <motion.section
                  key={candidate.id}
                  className="mix-glass pull-decision pull-decision--swipe"
                  style={{ x, rotate }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.92}
                  onDragEnd={onDragEnd}
                  whileDrag={{ cursor: 'grabbing' }}
                  aria-roledescription="swipeable card"
                  aria-label={`${candidate.title}. Swipe right to add, left to deny.`}
                >
                  <p className="pull-decision-gesture" aria-hidden>
                    ← deny · add →
                  </p>
                  <h3 className="pull-decision-label">One decision</h3>
                  <p className="pull-decision-title">
                    {candidate.title}
                    {' — '}
                    {safeFormatIso(candidate.start, 'EEEE h:mm')}
                  </p>
                  <p className="pull-decision-meta">
                    {candidate.sourceLabel}
                    {' · '}
                    {Math.round(candidate.confidence * 100)}%
                    {candidate.source === 'texts' ? ' · SMS' : ''}
                  </p>
                </motion.section>

                <div className="pull-decision-actions">
                  <button
                    type="button"
                    className="btn btn-ghost pull-decision-deny"
                    onClick={() => decide('deny')}
                  >
                    Deny
                    {remaining > 1 ? ` · ${remaining - 1}` : ''}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary pull-decision-add"
                    onClick={() => decide('add')}
                  >
                    Add
                  </button>
                </div>
                <p className="pull-decision-a11y-hint">
                  ← deny · → add · Esc close
                </p>
              </div>
            ) : (
              <section className="mix-glass pull-decision">
                <h3 className="pull-decision-label">Inbox clear</h3>
                <p className="pull-decision-meta">
                  Nothing waiting. Connect Google, then Pull again.
                </p>
              </section>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
