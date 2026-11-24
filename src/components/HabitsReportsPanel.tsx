import { useMemo, useState } from 'react'
import type {
  CalendarEvent,
  DailyTodo,
  Goal,
  GoalPeriod,
  JournalEntry,
  MoodCheckIn,
  TaskGroup,
} from '../types'
import { GOAL_PERIODS, periodLabel } from '../lib/goals'
import { habitSummaryForPeriod } from '../lib/habits'
import { buildReflectionReport } from '../lib/reports'

type Props = {
  todos: DailyTodo[]
  events: CalendarEvent[]
  groups: TaskGroup[]
  goals: Goal[]
  journal: JournalEntry[]
  checkIns: MoodCheckIn[]
}

function Bars({
  rows,
  empty,
}: {
  rows: { label: string; count: number; color?: string }[]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="habits-empty">{empty}</p>
  }
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="report-bars">
      {rows.slice(0, 8).map((r) => (
        <li key={r.label}>
          <span className="report-bar-label">{r.label}</span>
          <span className="report-bar-track">
            <span
              style={{
                width: `${Math.round((r.count / max) * 100)}%`,
                background: r.color
                  ? `linear-gradient(90deg, ${r.color}, transparent)`
                  : undefined,
              }}
            />
          </span>
          <span className="report-bar-count">{r.count}</span>
        </li>
      ))}
    </ul>
  )
}

export function HabitsReportsPanel({
  todos,
  events,
  groups,
  goals,
  journal,
  checkIns,
}: Props) {
  const [period, setPeriod] = useState<GoalPeriod>('weekly')

  const habits = useMemo(
    () =>
      habitSummaryForPeriod(period, {
        todos,
        events,
        groups,
        goals,
      }),
    [period, todos, events, groups, goals],
  )

  const report = useMemo(
    () =>
      buildReflectionReport(period, {
        checkIns,
        journal,
        todos,
        events,
      }),
    [period, checkIns, journal, todos, events],
  )

  return (
    <div className="habits-reports">
      <div className="goals-period-tabs" role="tablist" aria-label="Report period">
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
      <p className="goals-period-label">
        {periodLabel(period, habits.periodKey)}
      </p>

      <section className="habits-section" aria-label="Habit tracking">
        <h3 className="habits-heading">Habit tracking</h3>
        <div className="habits-stat-row">
          <div className="habits-stat">
            <strong>{habits.todoDone}</strong>
            <span>todos done</span>
          </div>
          <div className="habits-stat">
            <strong>{habits.eventsCompleted}</strong>
            <span>events done</span>
          </div>
          <div className="habits-stat">
            <strong>
              {habits.todoTotal + habits.eventsTotal === 0
                ? '—'
                : `${Math.round(
                    ((habits.todoDone + habits.eventsCompleted) /
                      Math.max(1, habits.todoTotal + habits.eventsTotal)) *
                      100,
                  )}%`}
            </strong>
            <span>completion</span>
          </div>
        </div>

        <ul className="habits-groups">
          {habits.byGroup.map((g) => (
            <li key={g.groupId} className="habits-group-row">
              <span
                className="habits-group-dot"
                style={{ background: g.color }}
                aria-hidden
              />
              <div className="habits-group-copy">
                <strong>{g.label}</strong>
                <span>
                  {g.completed}/{g.total} · {g.daysActive} day
                  {g.daysActive === 1 ? '' : 's'} active
                </span>
              </div>
              <div className="goals-progress-bar habits-group-bar">
                <span
                  style={{
                    width: `${g.total ? Math.round((g.completed / g.total) * 100) : 0}%`,
                    background: g.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        {habits.byGroup.length === 0 && (
          <p className="habits-empty">
            Pull task groups into daily todos to track habits here.
          </p>
        )}
      </section>

      <section className="habits-section" aria-label="Reflection reports">
        <h3 className="habits-heading">Reports</h3>
        <div className="habits-stat-row">
          <div className="habits-stat">
            <strong>
              {report.avgEnergy == null ? '—' : report.avgEnergy}
            </strong>
            <span>avg energy</span>
          </div>
          <div className="habits-stat">
            <strong>{report.checkInCount}</strong>
            <span>check-ins</span>
          </div>
          <div className="habits-stat">
            <strong>{report.journalCount}</strong>
            <span>journal</span>
          </div>
        </div>

        <h4 className="habits-subhead">Moods</h4>
        <Bars rows={report.moodCounts} empty="No mood check-ins in this span yet." />

        <h4 className="habits-subhead">Feelings</h4>
        <Bars
          rows={report.feelingCounts}
          empty="Log a feeling prompt in Journal to fill this."
        />

        <h4 className="habits-subhead">Keywords</h4>
        <Bars
          rows={report.keywordCounts}
          empty="Keywords appear as you write in Journal."
        />

        <h4 className="habits-subhead">Best energy days</h4>
        <DayList
          days={report.bestEnergyDays}
          empty="Energy logs will surface your brightest days."
          suffix="/5"
        />

        <h4 className="habits-subhead">Best mood days</h4>
        <DayList
          days={report.bestMoodDays}
          empty="Mood check-ins rank calmer / brighter days."
        />

        <h4 className="habits-subhead">Most completed tasks</h4>
        <DayList
          days={report.mostCompletedDays}
          empty="Complete todos or events to rank busy-good days."
          suffix=" done"
        />
      </section>
    </div>
  )
}

function DayList({
  days,
  empty,
  suffix = '',
}: {
  days: { date: string; label: string; value: number }[]
  empty: string
  suffix?: string
}) {
  if (days.length === 0) return <p className="habits-empty">{empty}</p>
  return (
    <ul className="report-days">
      {days.map((d) => (
        <li key={d.date}>
          <span>{d.label}</span>
          <strong>
            {typeof d.value === 'number' && d.value % 1 !== 0
              ? d.value.toFixed(1)
              : Math.round(d.value)}
            {suffix}
          </strong>
        </li>
      ))}
    </ul>
  )
}
