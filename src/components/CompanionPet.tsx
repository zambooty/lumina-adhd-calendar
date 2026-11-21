import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { PetState } from '../types'
import { PET_QUIPS, petStage, petXp, STAGE_COPY, xpForNextStage } from '../lib/pet'
import { BlinkArt } from './BlinkArt'

type Props = {
  pet: PetState
  onReact: () => void
}

export function CompanionPet({ pet, onReact }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const bar = xpForNextStage(xp)
  const [quip, setQuip] = useState<string | null>(null)
  const [mood, setMood] = useState<'idle' | 'hover' | 'tap'>('idle')

  const stageKey = useMemo(() => stage, [stage])
  const quips = PET_QUIPS[stage]

  function pickQuip() {
    return quips[Math.floor(Math.random() * quips.length)]
  }

  function handleInteract() {
    onReact()
    setMood('tap')
    setQuip(pickQuip())
    window.setTimeout(() => setMood('idle'), 450)
    window.setTimeout(() => setQuip(null), 1600)
  }

  return (
    <div className="panel pet-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Companion</h2>
          <p className="panel-hint">Cute menace · grows from pulls + schedules</p>
        </div>
      </div>
      <div className="panel-body pet-stage">
        <div className="pet-stage-rail" aria-hidden>
          {(['egg', 'hatchling', 'cub', 'glowfox', 'legend'] as const).map((s, i) => {
            const order = ['egg', 'hatchling', 'cub', 'glowfox', 'legend'] as const
            const reached = order.indexOf(stage) >= i
            return (
              <span
                key={s}
                className={`pet-stage-dot${s === stage ? ' is-active' : ''}${reached ? ' is-reached' : ''}`}
                title={STAGE_COPY[s].title}
              />
            )
          })}
        </div>

        <motion.button
          type="button"
          className={`pet-avatar pet-avatar--${stage}`}
          aria-label={`${pet.name} the ${copy.title}. Tap for sass.`}
          onClick={handleInteract}
          onHoverStart={() => {
            setMood('hover')
            setQuip(pickQuip())
          }}
          onHoverEnd={() => {
            setMood('idle')
            setQuip(null)
          }}
          animate={
            mood === 'tap'
              ? { y: [0, -18, 0], rotate: [0, -12, 10, -4, 0], scale: [1, 1.08, 0.95, 1] }
              : {
                  y: [0, -10, 0],
                  rotate: [0, -3, 3, 0],
                  scale: [1, 1.03, 1],
                }
          }
          transition={
            mood === 'tap'
              ? { duration: 0.55, ease: 'easeOut' }
              : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
          }
          whileHover={{ scale: 1.06 }}
          key={stageKey}
        >
          <span className="pet-wiggle-ring" aria-hidden />
          <BlinkArt stage={stage} mood={mood} />
        </motion.button>

        <AnimatePresence>
          {quip && (
            <motion.div
              key={quip}
              className="pet-quip"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            >
              “{quip}”
            </motion.div>
          )}
        </AnimatePresence>

        <h3 className="pet-name">
          {pet.name} · <span className="pet-title-accent">{copy.title}</span>
        </h3>
        <p className="pet-blurb">{copy.blurb}</p>
        <p className="pet-vibe">{copy.vibe}</p>

        <div className="xp-track" aria-hidden>
          <motion.div
            className="xp-fill"
            initial={false}
            animate={{ width: `${bar.progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>
        <div className="xp-meta">
          <span>
            XP {xp} · pulled {pet.eventsPulled} · scheduled {pet.eventsScheduled}
          </span>
          <span>{xp >= 24 ? 'Max diva' : `next @ ${bar.next}`}</span>
        </div>
      </div>
    </div>
  )
}
