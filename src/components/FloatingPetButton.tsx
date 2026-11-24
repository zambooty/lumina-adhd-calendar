import { motion } from 'framer-motion'
import type { PetState } from '../types'
import { petStage, petXp, STAGE_COPY } from '../lib/pet'
import { BlinkArt } from './BlinkArt'

type Props = {
  pet: PetState
  onOpen: () => void
  hidden?: boolean
}

/** Always-on floating Blink — opens the pet screen. */
export function FloatingPetButton({ pet, onOpen, hidden }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]

  if (hidden) return null

  return (
    <motion.button
      type="button"
      className="floating-pet-fab"
      aria-label={`Open ${pet.name} pet screen · ${copy.title}`}
      title={`${pet.name} · ${copy.title} · ${xp} XP`}
      onClick={onOpen}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        scale: { type: 'spring', stiffness: 280, damping: 18 },
        opacity: { duration: 0.35 },
      }}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.06 }}
    >
      <span className="floating-pet-fab-bob" aria-hidden>
        <span className="floating-pet-fab-ring" />
        <span className="floating-pet-fab-glow" />
        <BlinkArt stage={stage} mood="idle" />
      </span>
      <span className="floating-pet-fab-xp" aria-hidden>
        {xp}
      </span>
    </motion.button>
  )
}
