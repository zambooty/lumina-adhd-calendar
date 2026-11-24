import { format } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { EnergyLevel, FeelingCategoryId, MoodCheckIn } from '../types'
import {
  ENERGY_LEVELS,
  FEELING_CATEGORIES,
  checkInsForDay,
  energyLabel,
  feelingCategoryById,
} from '../lib/feelings'
import { dayKey } from '../lib/dailyTodos'

type Props = {
  checkIns: MoodCheckIn[]
  /** Compact strip for MixHome — prompt + today’s summary. */
  compact?: boolean
  onAdd: (input: {
    categoryId: FeelingCategoryId
    feelingId: string
    feelingLabel: string
    energy: EnergyLevel
    date?: string
  }) => void
}

type Step =
  | { kind: 'categories' }
  | { kind: 'feelings'; categoryId: FeelingCategoryId }
  | {
      kind: 'energy'
      categoryId: FeelingCategoryId
      feelingId: string
      feelingLabel: string
    }
  | { kind: 'done'; label: string; energy: EnergyLevel; at: string }

export function FeelingCheckIn({
  checkIns,
  compact = false,
  onAdd,
}: Props) {
  const dateKey = dayKey()
  const today = useMemo(
    () => checkInsForDay(checkIns, dateKey),
    [checkIns, dateKey],
  )
  const [step, setStep] = useState<Step>({ kind: 'categories' })
  // Compact home: stay collapsed until tapped — don't bury calendar under 6 vibes.
  const [expanded, setExpanded] = useState(!compact)

  function reset() {
    setStep({ kind: 'categories' })
  }

  function save(
    categoryId: FeelingCategoryId,
    feelingId: string,
    feelingLabel: string,
    energy: EnergyLevel,
  ) {
    onAdd({ categoryId, feelingId, feelingLabel, energy, date: dateKey })
    setStep({
      kind: 'done',
      label: feelingLabel,
      energy,
      at: new Date().toISOString(),
    })
    if (compact) {
      window.setTimeout(() => {
        setExpanded(false)
        reset()
      }, 1400)
    }
  }

  if (compact && !expanded) {
    const latest = today[today.length - 1]
    return (
      <section className="mix-glass mix-feel" aria-label="Feeling check-in">
        <div className="mix-feel-head">
          <div>
            <h2 className="mix-rail-title">How are you feeling?</h2>
            <p className="mix-rail-hint">
              {latest
                ? `Today · ${latest.feelingLabel} · ${energyLabel(latest.energy)}${
                    today.length > 1 ? ` · ${today.length} check-ins` : ''
                  }`
                : 'Optional — tap when you want a check-in.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              reset()
              setExpanded(true)
            }}
          >
            {today.length ? 'Again' : 'Check in'}
          </button>
        </div>
        {today.length > 0 && (
          <div className="feel-tint-preview" aria-hidden>
            {today.map((c) => (
              <span
                key={c.id}
                className="feel-tint-swatch"
                style={{
                  background: feelingCategoryById(c.categoryId).color,
                }}
              />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <div
      className={`feeling-checkin${compact ? ' feeling-checkin--compact' : ''}`}
      aria-label={compact ? 'Feeling check-in' : undefined}
    >
      {!compact && (
        <div className="feeling-checkin-intro">
          <p>
            Broad vibe → specific word → energy. Days tint on the calendar.
          </p>
        </div>
      )}

      {compact && (
        <div className="mix-feel-head">
          <div>
            <h2 className="mix-rail-title">How are you feeling?</h2>
            <p className="mix-rail-hint">
              {step.kind === 'categories' && 'Pick a vibe.'}
              {step.kind === 'feelings' && 'Pick a word.'}
              {step.kind === 'energy' && 'Energy level?'}
              {step.kind === 'done' && 'Logged — day will tint.'}
            </p>
          </div>
          {step.kind === 'categories' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                reset()
                setExpanded(false)
              }}
            >
              Later
            </button>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step.kind === 'categories' && (
          <motion.div
            key="cats"
            className="feel-step"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <p className="feel-step-label" id="feel-cat-label">
              Broad vibe
            </p>
            <div
              className="feel-cat-grid"
              role="group"
              aria-labelledby="feel-cat-label"
            >
              {FEELING_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="feel-cat-chip"
                  style={{ ['--feel-color' as string]: cat.color }}
                  onClick={() =>
                    setStep({ kind: 'feelings', categoryId: cat.id })
                  }
                >
                  <span className="feel-cat-dot" aria-hidden />
                  <span className="feel-cat-copy">
                    <strong>{cat.label}</strong>
                    <span>{cat.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step.kind === 'feelings' && (
          <motion.div
            key="feelings"
            className="feel-step"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm feel-back"
              onClick={() => setStep({ kind: 'categories' })}
            >
              ← Broad vibes
            </button>
            <p className="feel-step-label" id="feel-spec-label">
              {feelingCategoryById(step.categoryId).label} → specific
            </p>
            <div
              className="feel-spec-grid"
              role="group"
              aria-labelledby="feel-spec-label"
            >
              {feelingCategoryById(step.categoryId).feelings.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="feel-spec-chip"
                  style={{
                    ['--feel-color' as string]: feelingCategoryById(
                      step.categoryId,
                    ).color,
                  }}
                  onClick={() =>
                    setStep({
                      kind: 'energy',
                      categoryId: step.categoryId,
                      feelingId: f.id,
                      feelingLabel: f.label,
                    })
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step.kind === 'energy' && (
          <motion.div
            key="energy"
            className="feel-step"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm feel-back"
              onClick={() =>
                setStep({
                  kind: 'feelings',
                  categoryId: step.categoryId,
                })
              }
            >
              ← Feelings
            </button>
            <p className="feel-step-label" id="feel-energy-label">
              Energy level · {step.feelingLabel}
            </p>
            <div
              className="feel-energy-row"
              role="group"
              aria-labelledby="feel-energy-label"
            >
              {ENERGY_LEVELS.map((e) => (
                <button
                  key={e.level}
                  type="button"
                  className="feel-energy-chip"
                  title={e.hint}
                  onClick={() =>
                    save(
                      step.categoryId,
                      step.feelingId,
                      step.feelingLabel,
                      e.level,
                    )
                  }
                >
                  <strong>{e.level}</strong>
                  <span>{e.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step.kind === 'done' && (
          <motion.div
            key="done"
            className="feel-step feel-step--done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="feel-done-title">Logged · {step.label}</p>
            <p className="feel-done-meta">
              Energy {step.energy} · {energyLabel(step.energy)} ·{' '}
              {format(new Date(step.at), 'h:mm a')}
            </p>
            {!compact && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={reset}
              >
                Check in again
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {today.length > 0 && step.kind === 'categories' && (
        <div className="feel-today-list" aria-label="Today’s check-ins">
          <p className="feel-step-label">Today · {today.length}</p>
          <ul>
            {today.map((c) => (
              <li key={c.id} className="feel-today-row">
                <span
                  className="feel-today-dot"
                  style={{
                    background: feelingCategoryById(c.categoryId).color,
                  }}
                  aria-hidden
                />
                <span className="feel-today-copy">
                  <strong>{c.feelingLabel}</strong>
                  <span>
                    {energyLabel(c.energy)} ·{' '}
                    {format(new Date(c.createdAt), 'h:mm a')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {today.length > 1 && (
            <p className="feel-today-hint">
              Calendar tint blends these left → right.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
