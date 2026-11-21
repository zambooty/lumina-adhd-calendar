import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { PetState } from '../types'
import { PET_QUIPS, petStage, petXp, STAGE_COPY } from '../lib/pet'
import { BlinkArt } from './BlinkArt'

type Props = {
  pet: PetState
  onReact: () => void
}

/** Compact Blink for the top header — tap for sass. */
export function BlinkHeaderPet({ pet, onReact }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const [mood, setMood] = useState<'idle' | 'hover' | 'tap'>('idle')
  const quips = useMemo(() => PET_QUIPS[stage], [stage])

  function handleTap() {
    onReact()
    setMood('tap')
    window.setTimeout(() => setMood('idle'), 420)
  }

  return (
    <motion.button
      type="button"
      className="blink-header-pet"
      aria-label={`${pet.name} the ${copy.title}. Tap for sass.`}
      title={`${pet.name} · ${copy.title}`}
      onClick={handleTap}
      animate={
        mood === 'tap'
          ? { y: [0, -6, 0], rotate: [0, -8, 6, 0], scale: [1, 1.08, 1] }
          : { y: [0, -3, 0] }
      }
      transition={
        mood === 'tap'
          ? { duration: 0.4 }
          : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
      }
      whileTap={{ scale: 0.94 }}
    >
      <span className="blink-header-ring" aria-hidden />
      <BlinkArt stage={stage} mood={mood} />
      <span className="visually-hidden">{quips[0]}</span>
    </motion.button>
  )
}
