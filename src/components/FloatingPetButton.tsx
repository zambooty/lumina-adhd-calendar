import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PetState, PetStoreState } from '../types'
import { petStage, petXp, STAGE_COPY } from '../lib/pet'
import { resolvePetLooks } from '../lib/petLooks'
import { BlinkArt } from './BlinkArt'
import { LazyPetWebGL } from './pet3d/LazyPetWebGL'

type Props = {
  pet: PetState
  store?: PetStoreState | null
  onOpen: () => void
  hidden?: boolean
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Always-on floating Blink — WebGL fab (SVG if reduced-motion). */
export function FloatingPetButton({ pet, store, onOpen, hidden }: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const looks = useMemo(() => resolvePetLooks(stage, store), [stage, store])
  const reducedMotion = usePrefersReducedMotion()
  const [mood, setMood] = useState<'idle' | 'happy'>('idle')
  const skipHappy = useRef(true)

  useEffect(() => {
    if (skipHappy.current) {
      skipHappy.current = false
      return
    }
    setMood('happy')
    const id = window.setTimeout(() => setMood('idle'), 900)
    return () => window.clearTimeout(id)
  }, [pet.lastReactedAt, xp])

  if (hidden) return null

  return (
    <motion.button
      type="button"
      className="floating-pet-fab"
      aria-label={`Open ${pet.name} pet screen · ${copy.title}`}
      title={`${pet.name} · ${copy.title} · ${xp} XP`}
      onClick={onOpen}
      initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        scale: { type: 'spring', stiffness: 280, damping: 18 },
        opacity: { duration: 0.35 },
      }}
      whileTap={reducedMotion ? undefined : { scale: 0.92 }}
      whileHover={reducedMotion ? undefined : { scale: 1.06 }}
    >
      <span className="floating-pet-fab-bob" aria-hidden>
        <span className="floating-pet-fab-ring" />
        {reducedMotion ? (
          <BlinkArt stage={stage} mood="idle" />
        ) : (
          <LazyPetWebGL
            stage={stage}
            looks={looks}
            mood={mood}
            reducedMotion={false}
            size="fab"
            className="floating-pet-fab-webgl"
          />
        )}
      </span>
      <span className="floating-pet-fab-xp" aria-hidden>
        {xp}
      </span>
    </motion.button>
  )
}
