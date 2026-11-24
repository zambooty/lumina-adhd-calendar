import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { PetState } from '../types'
import {
  PET_QUIPS,
  pickQuip,
  pickSpeech,
  petStage,
  petXp,
  STAGE_COPY,
} from '../lib/pet'
import { BlinkArt } from './BlinkArt'

type Props = {
  pet: PetState
  /** Larger stage for full pet screen. */
  size?: 'fab' | 'panel' | 'hero'
  /** Auto-cycle longer speech lines. */
  speak?: boolean
  speechIntervalMs?: number
  onSpeak?: (line: string) => void
  onInteract?: () => void
  className?: string
}

/**
 * CSS-perspective “3D” Blink stage — float, tilt, and speech bubbles.
 * Real WebGL/Three.js pet is a follow-up; Cap/web stay light here.
 */
export function PetStage3D({
  pet,
  size = 'panel',
  speak = false,
  speechIntervalMs = 5200,
  onSpeak,
  onInteract,
  className = '',
}: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const [mood, setMood] = useState<'idle' | 'hover' | 'tap'>('idle')
  const [bubble, setBubble] = useState<string | null>(
    speak ? pickSpeech(stage, pet.lastSpeech) : null,
  )

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
    const line = speak ? pickSpeech(stage, bubble) : pickQuip(stage)
    setBubble(line)
    onSpeak?.(line)
    window.setTimeout(() => setMood('idle'), 520)
  }

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
        <motion.button
          type="button"
          className={`pet-stage3d-figure pet-avatar--${stage}`}
          aria-label={`${pet.name} the ${copy.title}. Tap to talk.`}
          onClick={handleInteract}
          onHoverStart={() => {
            setMood('hover')
            if (!speak) setBubble(PET_QUIPS[stage][0])
          }}
          onHoverEnd={() => {
            setMood('idle')
            if (!speak) setBubble(null)
          }}
          animate={
            mood === 'tap'
              ? {
                  y: [0, -28, 0],
                  rotateY: [0, -28, 22, 0],
                  rotateX: [8, -6, 10, 8],
                  scale: [1, 1.1, 0.96, 1],
                }
              : {
                  y: [0, -14, 0],
                  rotateY: [-16, 16, -16],
                  rotateX: [10, 4, 10],
                  scale: [1, 1.03, 1],
                }
          }
          transition={
            mood === 'tap'
              ? { duration: 0.65, ease: 'easeOut' }
              : {
                  duration: size === 'fab' ? 3.2 : 4.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          style={{ transformStyle: 'preserve-3d' }}
          whileTap={{ scale: 0.94 }}
        >
          <span className="pet-stage3d-ring" aria-hidden />
          <span className="pet-stage3d-shadow" aria-hidden />
          <span className="pet-stage3d-face" style={{ transform: 'translateZ(28px)' }}>
            <BlinkArt stage={stage} mood={mood} />
          </span>
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {bubble && (
          <motion.div
            key={bubble}
            className="pet-speech-bubble"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.88, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
          >
            <span className="pet-speech-bubble-tail" aria-hidden />
            “{bubble}”
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
