import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import { useMemo, useState, type FormEvent } from 'react'
import type { Goal, JournalEntry } from '../types'
import { dayKey, parseDayKey } from '../lib/dailyTodos'
import {
  ENERGY_LEVELS,
  FEELING_CATEGORIES,
  pickFeelingPrompt,
} from '../lib/feelings'
import { extractKeywords } from '../lib/journal'
import { activeGoalsForPeriod, GOAL_PERIODS } from '../lib/goals'

type Props = {
  entries: JournalEntry[]
  goals: Goal[]
  onAdd: (input: {
    body: string
    date?: string
    goalId?: string
    prompt?: string
    feelingCategory?: string
    feeling?: string
    feelingId?: string
    energy?: number
    keywords?: string[]
  }) => void
  onRemove: (entryId: string) => void
}

export function JournalPanel({ entries, goals, onAdd, onRemove }: Props) {
  const [body, setBody] = useState('')
  const [goalId, setGoalId] = useState('')
  const [useFeeling, setUseFeeling] = useState(false)
  const [feelingCat, setFeelingCat] = useState<string | null>(null)
  const [feeling, setFeeling] = useState<string | null>(null)
  const [energy, setEnergy] = useState<number>(3)
  const [feelingSeed] = useState(() => Date.now())

  const liveGoals = useMemo(() => {
    const all: Goal[] = []
    for (const p of GOAL_PERIODS) {
      all.push(...activeGoalsForPeriod(goals, p.id))
    }
    return all
  }, [goals])

  const selectedGoal = liveGoals.find((g) => g.id === goalId)
  const feelingPrompt = pickFeelingPrompt(feelingSeed)
  const autoKeywords = useMemo(() => extractKeywords(body), [body])
  const cat = FEELING_CATEGORIES.find((c) => c.id === feelingCat)

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      ),
    [entries],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text && !feeling) return
    const prompt = useFeeling
      ? feelingPrompt
      : selectedGoal?.prompt
    onAdd({
      body: text || (feeling ? `Feeling: ${feeling}` : ''),
      goalId: selectedGoal?.id,
      prompt,
      feelingCategory: useFeeling ? feelingCat ?? undefined : undefined,
      feeling: useFeeling ? feeling ?? undefined : undefined,
      feelingId: useFeeling
        ? cat?.feelings.find((f) => f.label === feeling)?.id
        : undefined,
      energy: useFeeling ? energy : undefined,
      keywords: autoKeywords,
    })
    setBody('')
    setFeeling(null)
    setFeelingCat(null)
    setUseFeeling(false)
  }

  return (
    <div className="journal-panel">
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-prompt-row">
          <label className="journal-field journal-field--grow">
            <span>Optional goal prompt</span>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              aria-label="Tie entry to a goal"
              disabled={useFeeling}
            >
              <option value="">Free write</option>
              {liveGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`btn btn-sm${useFeeling ? ' btn-primary' : ' btn-ghost'}`}
            aria-pressed={useFeeling}
            onClick={() => setUseFeeling((v) => !v)}
          >
            Feeling prompt
          </button>
        </div>

        {selectedGoal && !useFeeling && (
          <p className="journal-active-prompt">{selectedGoal.prompt}</p>
        )}
        {useFeeling && (
          <p className="journal-active-prompt">{feelingPrompt}</p>
        )}

        {useFeeling && (
          <div className="journal-feelings">
            <div className="journal-feeling-cats" role="group" aria-label="Feeling category">
              {FEELING_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`journal-feeling-cat${feelingCat === c.id ? ' is-active' : ''}`}
                  style={{ ['--feel' as string]: c.color }}
                  onClick={() => {
                    setFeelingCat(c.id)
                    setFeeling(null)
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {cat && (
              <div className="journal-feeling-list" role="group" aria-label="Specific feeling">
                {cat.feelings.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`journal-feeling-chip${feeling === f.label ? ' is-active' : ''}`}
                    onClick={() => setFeeling(f.label)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <div className="journal-energy" role="group" aria-label="Energy level">
              <span>Energy</span>
              {ENERGY_LEVELS.map((lvl) => (
                <button
                  key={lvl.level}
                  type="button"
                  className={`journal-energy-chip${energy === lvl.level ? ' is-active' : ''}`}
                  onClick={() => setEnergy(lvl.level)}
                >
                  {lvl.level}
                  <em>{lvl.label}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="journal-field">
          <span>Entry</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Brain dump, win, stuck point — whatever’s here…"
            aria-label="Journal entry"
          />
        </label>

        {autoKeywords.length > 0 && (
          <div className="journal-keywords" aria-label="Recognized keywords">
            {autoKeywords.map((k) => (
              <span key={k} className="journal-keyword">
                {k}
              </span>
            ))}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-sm">
          Save entry
        </button>
      </form>

      <ul className="journal-list" aria-label="Journal entries">
        <AnimatePresence initial={false}>
          {sorted.map((entry) => (
            <motion.li
              key={entry.id}
              className="journal-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              layout
            >
              <div className="journal-card-head">
                <strong>
                  {entry.date === dayKey()
                    ? 'Today'
                    : format(parseDayKey(entry.date), 'EEE · MMM d')}
                </strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label="Delete entry"
                  onClick={() => onRemove(entry.id)}
                >
                  ✕
                </button>
              </div>
              {entry.prompt && (
                <p className="journal-card-prompt">{entry.prompt}</p>
              )}
              <p className="journal-card-body">{entry.body}</p>
              <div className="journal-card-meta">
                {entry.feeling && (
                  <span className="journal-meta-chip">{entry.feeling}</span>
                )}
                {entry.energy != null && (
                  <span className="journal-meta-chip">
                    Energy {entry.energy}
                  </span>
                )}
                {entry.keywords.map((k) => (
                  <span key={k} className="journal-keyword">
                    {k}
                  </span>
                ))}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {sorted.length === 0 && (
        <p className="journal-empty">
          No entries yet — optional prompts keep the blank page soft.
        </p>
      )}
    </div>
  )
}
