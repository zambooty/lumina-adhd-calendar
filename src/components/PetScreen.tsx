import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import type { PetState, PetStoreState } from '../types'
import {
  petStage,
  petXp,
  STAGE_COPY,
  xpForNextStage,
} from '../lib/pet'
import { equippedPreview } from '../lib/petStore'
import { PetStage3D } from './PetStage3D'

type Props = {
  open: boolean
  pet: PetState
  store?: PetStoreState | null
  onClose: () => void
  onReact: () => void
  onSpeak: (line: string) => void
}

/** Full-screen dark glass pet room — WebGL Blink + speech, one clear CTA. */
export function PetScreen({
  open,
  pet,
  store,
  onClose,
  onReact,
  onSpeak,
}: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const bar = xpForNextStage(xp)
  const preview = useMemo(
    () => (store ? equippedPreview(store) : null),
    [store],
  )
  const [boopNonce, setBoopNonce] = useState(0)

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
              store={store}
              size="hero"
              speak
              onSpeak={handleSpeak}
              onInteract={onReact}
              interactNonce={boopNonce}
            />

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

            {preview && (
              <p className="pet-screen-fit" aria-label="Equipped look">
                <span style={{ color: preview.accent }}>{preview.animal}</span>
                {' · '}
                {preview.color}
                {preview.clothes !== 'No fit' ? ` · ${preview.clothes}` : ''}
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary pet-screen-cta"
              onClick={() => setBoopNonce((n) => n + 1)}
            >
              Boop {pet.name}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
