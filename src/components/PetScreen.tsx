import { AnimatePresence, motion } from 'framer-motion'
import { useCallback } from 'react'
import type { PetState } from '../types'
import {
  growthBreakdown,
  petStage,
  petXp,
  STAGE_COPY,
  xpForNextStage,
} from '../lib/pet'
import { PetStage3D } from './PetStage3D'

type Props = {
  open: boolean
  pet: PetState
  onClose: () => void
  onReact: () => void
  onSpeak: (line: string) => void
}

/** Full-screen dark glass pet room — motion + speech + growth breakdown. */
export function PetScreen({ open, pet, onClose, onReact, onSpeak }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const bar = xpForNextStage(xp)
  const breakdown = growthBreakdown(pet)

  const handleSpeak = useCallback(
    (line: string) => {
      onSpeak(line)
    },
    [onSpeak],
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pet-screen-root"
          role="dialog"
          aria-modal="true"
          aria-label={`${pet.name} pet screen`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="pet-screen-backdrop"
            aria-label="Close pet screen"
            onClick={onClose}
          />
          <motion.div
            className="pet-screen-panel mix-glass"
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 28, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            <header className="pet-screen-header">
              <div>
                <p className="pet-screen-kicker">Companion</p>
                <h2 className="pet-screen-title">
                  {pet.name}{' '}
                  <span className="pet-title-accent">{copy.title}</span>
                </h2>
                <p className="pet-screen-vibe">{copy.vibe}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm pet-screen-close"
                onClick={onClose}
              >
                Close
              </button>
            </header>

            <PetStage3D
              pet={pet}
              size="hero"
              speak
              onSpeak={handleSpeak}
              onInteract={onReact}
            />

            <p className="pet-screen-blurb">{copy.blurb}</p>

            <div className="pet-stage-rail" aria-hidden>
              {(['egg', 'hatchling', 'cub', 'glowfox', 'legend'] as const).map(
                (s, i) => {
                  const order = [
                    'egg',
                    'hatchling',
                    'cub',
                    'glowfox',
                    'legend',
                  ] as const
                  const reached = order.indexOf(stage) >= i
                  return (
                    <span
                      key={s}
                      className={`pet-stage-dot${s === stage ? ' is-active' : ''}${reached ? ' is-reached' : ''}`}
                      title={STAGE_COPY[s].title}
                    />
                  )
                },
              )}
            </div>

            <div className="xp-track" aria-hidden>
              <motion.div
                className="xp-fill"
                initial={false}
                animate={{ width: `${bar.progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              />
            </div>
            <div className="xp-meta">
              <span>XP {xp}</span>
              <span>{xp >= 24 ? 'Max diva' : `next @ ${bar.next}`}</span>
            </div>

            <ul className="pet-growth-grid" aria-label="How Blink grows">
              {breakdown.map((row) => (
                <li key={row.key} className="pet-growth-chip">
                  <span className="pet-growth-value">{row.value}</span>
                  <span className="pet-growth-label">{row.label}</span>
                </li>
              ))}
            </ul>

            <p className="pet-screen-note">
              Grows from pulls, schedules, task completion, journaling, and mood
              check-ins. CSS 3D motion + speech for Cap/web — true WebGL pet is
              next.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
