import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type FormEvent } from 'react'
import type { CalendarEvent, DailyTodo, Goal, GoalPeriod, TaskGroup } from '../types'
import {
  GOAL_PERIODS,
  activeGoalsForPeriod,
  goalTitleFromGroup,
  goalsNeedingPrompt,
  periodKeyFor,
  periodLabel,
  pickGoalPrompt,
} from '../lib/goals'
import { goalProgress } from '../lib/habits'

type Props = {
  goals: Goal[]
  groups: TaskGroup[]
  todos: DailyTodo[]
  events: CalendarEvent[]
  onAdd: (input: {
    period: GoalPeriod
    title: string
    prompt: string
    taskGroupId?: string
    targetCount?: number
  }) => void
  onArchive: (goalId: string) => void
}

export function GoalsPanel({
  goals,
  groups,
  todos,
  events,
  onAdd,
  onArchive,
}: Props) {
  const [period, setPeriod] = useState<GoalPeriod>('weekly')
  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [promptSeed] = useState(() => Date.now())
  const prompt = useMemo(
    () => pickGoalPrompt(period, promptSeed + period.length),
    [period, promptSeed],
  )

  const needing = goalsNeedingPrompt(goals)
  const active = activeGoalsForPeriod(goals, period)
  const key = periodKeyFor(period)

  function submit(e: FormEvent) {
    e.preventDefault()
    const group = groups.find((g) => g.id === groupId)
    const resolvedTitle =
      title.trim() ||
      (group ? goalTitleFromGroup(group, period) : prompt.replace(/\?$/, ''))
    if (!resolvedTitle) return
    onAdd({
      period,
      title: resolvedTitle,
      prompt,
      taskGroupId: group?.id,
      targetCount:
        period === 'weekly' ? 5 : period === 'monthly' ? 20 : 80,
    })
    setTitle('')
    setGroupId('')
  }

  return (
    <div className="goals-panel">
      {needing.length > 0 && (
        <p className="goals-nudge" role="status">
          Soft prompt waiting for{' '}
          {needing
            .map((p) => GOAL_PERIODS.find((x) => x.id === p)?.short)
            .join(' · ')}
          .
        </p>
      )}

      <div className="goals-period-tabs" role="tablist" aria-label="Goal period">
        {GOAL_PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={`goals-period-tab${period === p.id ? ' is-active' : ''}`}
            onClick={() => setPeriod(p.id)}
          >
            {p.short}
          </button>
        ))}
      </div>

      <p className="goals-period-label">{periodLabel(period, key)}</p>
      <p className="goals-prompt">{prompt}</p>

      <form className="goals-form" onSubmit={submit}>
        <label className="goals-field">
          <span>Goal</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name it — or leave blank to use a group"
            aria-label="Goal title"
          />
        </label>
        <label className="goals-field">
          <span>Task group counts as goal</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            aria-label="Link task group"
          >
            <option value="">None — freeform</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          Set {GOAL_PERIODS.find((p) => p.id === period)?.label.toLowerCase()} goal
        </button>
      </form>

      <ul className="goals-list" aria-label="Active goals">
        <AnimatePresence initial={false}>
          {active.map((g) => {
            const progress = goalProgress(g, todos, events)
            const group = groups.find((x) => x.id === g.taskGroupId)
            return (
              <motion.li
                key={g.id}
                className="goals-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                layout
              >
                <div className="goals-card-top">
                  <strong>{g.title}</strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`Archive ${g.title}`}
                    onClick={() => onArchive(g.id)}
                  >
                    Done
                  </button>
                </div>
                {group && (
                  <span
                    className="goals-group-chip"
                    style={{ ['--chip' as string]: group.color }}
                  >
                    {group.label}
                  </span>
                )}
                <p className="goals-card-prompt">{g.prompt}</p>
                <div className="goals-progress" aria-label="Goal progress">
                  <div className="goals-progress-bar">
                    <span style={{ width: `${progress.pct}%` }} />
                  </div>
                  <span>
                    {progress.done}/{progress.target} completions
                  </span>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      {active.length === 0 && (
        <p className="goals-empty">
          No {period} goal yet — pick a task group or write your own.
        </p>
      )}
    </div>
  )
}
