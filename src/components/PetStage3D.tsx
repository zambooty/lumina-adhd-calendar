import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PetState, PetStoreState } from '../types'
import {
  PET_QUIPS,
  pickQuip,
  pickSpeech,
  petStage,
  petXp,
  STAGE_COPY,
} from '../lib/pet'
import { resolvePetLooks } from '../lib/petLooks'
import { BlinkArt } from './BlinkArt'
import { LazyPetWebGL } from './pet3d/LazyPetWebGL'
import type { PetAnimMood } from './pet3d/createBlinkPet'

type Props = {
  pet: PetState
  store?: PetStoreState | null
  /** Larger stage for full pet screen. */
  size?: 'fab' | 'panel' | 'hero'
  /** Auto-cycle longer speech lines. */
  speak?: boolean
  speechIntervalMs?: number
  onSpeak?: (line: string) => void
  onInteract?: () => void
  /** Parent increments to trigger the same tap react (e.g. Boop CTA). */
  interactNonce?: number
  className?: string
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

/**
 * WebGL Blink stage (three.js) — breathe / tap / happy bounce + speech.
 * Falls back to static SVG when prefers-reduced-motion.
 */
export function PetStage3D({
  pet,
  store,
  size = 'panel',
  speak = false,
  speechIntervalMs = 5200,
  onSpeak,
  onInteract,
  interactNonce = 0,
  className = '',
}: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const looks = useMemo(() => resolvePetLooks(stage, store), [stage, store])
  const reducedMotion = usePrefersReducedMotion()
  const [mood, setMood] = useState<PetAnimMood>('idle')
  const [svgMood, setSvgMood] = useState<'idle' | 'hover' | 'tap'>('idle')
  const [bubble, setBubble] = useState<string | null>(
    speak ? pickSpeech(stage, pet.lastSpeech) : null,
  )
  const bubbleRef = useRef(bubble)
  bubbleRef.current = bubble

  // Happy bounce when growth / react timestamps move (skip first paint).
  const skipHappy = useRef(true)
  useEffect(() => {
    if (skipHappy.current) {
      skipHappy.current = false
      return
    }
    setMood('happy')
    const id = window.setTimeout(() => setMood('idle'), 920)
    return () => window.clearTimeout(id)
  }, [pet.lastReactedAt, xp])

  useEffect(() => {
    if (!speak) return
    const line = pickSpeech(stage)
    setBubble(line)
    onSpeak?.(line)
    const id = window.setInterval(() => {
      setBubble((prev) => {
        const next = pickSpeech(stage, prev)
        onSpeak?.(next)
        return next
      })
    }, speechIntervalMs)
    return () => window.clearInterval(id)
    // onSpeak intentionally omitted — parent may setState on speak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, stage, speechIntervalMs])

  function handleInteract() {
    onInteract?.()
    setMood('tap')
    setSvgMood('tap')
    const line = speak
      ? pickSpeech(stage, bubbleRef.current)
      : pickQuip(stage)
    setBubble(line)
    onSpeak?.(line)
    window.setTimeout(() => {
      setMood('idle')
      setSvgMood('idle')
    }, 520)
  }

  const lastNonce = useRef(interactNonce)
  useEffect(() => {
    if (interactNonce === lastNonce.current) return
    lastNonce.current = interactNonce
    if (interactNonce > 0) handleInteract()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactNonce])

  return (
    <div
      className={`pet-stage3d pet-stage3d--${size} pet-stage3d--${stage} ${className}`.trim()}
    >
      <div className="pet-stage3d-sky" aria-hidden>
        <span className="pet-stage3d-orb pet-stage3d-orb--a" />
        <span className="pet-stage3d-orb pet-stage3d-orb--b" />
        <span className="pet-stage3d-orb pet-stage3d-orb--c" />
      </div>

      <div className="pet-stage3d-perspective">
        {reducedMotion ? (
          <button
            type="button"
            className={`pet-stage3d-figure pet-stage3d-figure--svg pet-avatar--${stage}`}
            aria-label={`${pet.name} the ${copy.title}. Tap to talk.`}
            onClick={handleInteract}
            onMouseEnter={() => {
              setSvgMood('hover')
              if (!speak) setBubble(PET_QUIPS[stage][0])
            }}
            onMouseLeave={() => {
              setSvgMood('idle')
              if (!speak) setBubble(null)
            }}
          >
            <span className="pet-stage3d-ring" aria-hidden />
            <span className="pet-stage3d-face">
              <BlinkArt stage={stage} mood={svgMood} />
            </span>
          </button>
        ) : (
          <LazyPetWebGL
            stage={stage}
            looks={looks}
            mood={mood}
            reducedMotion={false}
            size={size}
            className={`pet-stage3d-figure pet-stage3d-figure--webgl pet-avatar--${stage}`}
            aria-label={`${pet.name} the ${copy.title}. Tap to talk.`}
            onTap={handleInteract}
          />
        )}
      </div>

      <AnimatePresence mode="wait">
        {bubble && (
          <motion.div
            key={bubble}
            className="pet-speech-bubble"
            role="status"
            aria-live="polite"
            initial={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 0, y: 16, scale: 0.88, rotate: -2 }
            }
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.94 }}
            transition={
              reducedMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 360, damping: 24 }
            }
          >
            <span className="pet-speech-bubble-tail" aria-hidden />
            “{bubble}”
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
