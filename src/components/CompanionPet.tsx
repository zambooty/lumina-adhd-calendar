import { motion } from 'framer-motion'
import type { PetState, PetStoreState } from '../types'
import {
  growthBreakdown,
  petStage,
  petXp,
  STAGE_COPY,
  xpForNextStage,
} from '../lib/pet'
import { PetStage3D } from './PetStage3D'

type Props = {
  pet: PetState
  store?: PetStoreState | null
  onReact: () => void
  onSpeak?: (line: string) => void
  onOpenScreen?: () => void
}

export function CompanionPet({
  pet,
  store,
  onReact,
  onSpeak,
  onOpenScreen,
}: Props) {
  const xp = petXp(pet)
  const stage = petStage(xp)
  const copy = STAGE_COPY[stage]
  const bar = xpForNextStage(xp)
  const breakdown = growthBreakdown(pet)

  return (
    <div className="panel pet-panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Companion</h2>
          <p className="panel-hint">
            Cute menace · grows from pulls, tasks, journal & moods
          </p>
        </div>
        {onOpenScreen && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenScreen}
          >
            Open pet
          </button>
        )}
      </div>
      <div className="panel-body pet-stage">
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

        <PetStage3D
          pet={pet}
          store={store}
          size="panel"
          speak
          speechIntervalMs={6000}
          onSpeak={onSpeak}
          onInteract={onReact}
        />

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
          <span>XP {xp}</span>
          <span>{xp >= 24 ? 'Max diva' : `next @ ${bar.next}`}</span>
        </div>

        <ul className="pet-growth-grid pet-growth-grid--compact" aria-label="Growth">
          {breakdown.map((row) => (
            <li key={row.key} className="pet-growth-chip">
              <span className="pet-growth-value">{row.value}</span>
              <span className="pet-growth-label">{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
