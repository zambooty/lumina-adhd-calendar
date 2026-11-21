import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { PetState } from '../types'
import { petStage, petXp, STAGE_COPY, xpForNextStage } from '../lib/pet'

type Props = {
  pet: PetState
  onReact: () => void
}

const REACTIONS = ['boop!', 'spark!', 'yay!', 'zoom!', 'glow!']

export function CompanionPet({ pet, onReact }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const bar = xpForNextStage(xp)
  const [reaction, setReaction] = useState<string | null>(null)

  const stageKey = useMemo(() => stage, [stage])

  function handleInteract() {
    onReact()
    const word = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
    setReaction(word)
    window.setTimeout(() => setReaction(null), 900)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Companion</h2>
          <p className="panel-hint">Grows from pulls + schedules</p>
        </div>
      </div>
      <div className="panel-body pet-stage">
        <motion.button
          type="button"
          className="pet-avatar"
          aria-label={`${pet.name} the ${copy.title}. Tap to interact.`}
          onClick={handleInteract}
          onHoverStart={() => setReaction('…')}
          onHoverEnd={() => setReaction(null)}
          animate={{
            y: [0, -6, 0],
            boxShadow: [
              '0 0 28px rgba(61,255,212,0.35)',
              '0 0 48px rgba(200,255,77,0.45)',
              '0 0 28px rgba(61,255,212,0.35)',
            ],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          whileTap={{ scale: 0.9, rotate: -8 }}
          whileHover={{ scale: 1.05 }}
          key={stageKey}
        >
          <motion.span
            key={copy.emoji}
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            {copy.emoji}
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {reaction && (
            <motion.div
              key={reaction}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: -4 }}
              exit={{ opacity: 0, y: -16 }}
              style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'var(--lime)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                pointerEvents: 'none',
              }}
            >
              {reaction}
            </motion.div>
          )}
        </AnimatePresence>

        <h3 className="pet-name">
          {pet.name} · <span style={{ color: 'var(--cyan)' }}>{copy.title}</span>
        </h3>
        <p className="pet-blurb">{copy.blurb}</p>

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
          <span>
            {xp >= 24 ? 'Max' : `next @ ${bar.next}`}
          </span>
        </div>
      </div>
    </div>
  )
}
