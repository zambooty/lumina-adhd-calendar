import { motion } from 'framer-motion'
import { useState } from 'react'
import type { PetState } from '../types'
import { petStage, petXp, STAGE_COPY } from '../lib/pet'
import { BlinkArt } from './BlinkArt'

type Props = {
  pet: PetState
  onOpen: () => void
}

/** Compact Blink in the top header — opens the pet screen. */
export function BlinkHeaderPet({ pet, onOpen }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const [mood, setMood] = useState<'idle' | 'hover' | 'tap'>('idle')

  function handleTap() {
    setMood('tap')
    window.setTimeout(() => {
      setMood('idle')
      onOpen()
    }, 220)
  }

  return (
    <motion.button
      type="button"
      className="blink-header-pet"
      aria-label={`Open ${pet.name} pet screen · ${copy.title}`}
      title={`${pet.name} · ${copy.title} · ${xp} XP`}
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
    </motion.button>
  )
}
