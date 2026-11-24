export type SourceKind =
  | 'calendar'
  | 'notes'
  | 'email'
  | 'texts'
  | 'voicemail'

export type ReminderOffset = {
  id: string
  label: string
  /** Minutes before event start. Negative = after start (unused in MVP). */
  minutesBefore: number
}

export type ReminderStack = {
  id: string
  name: string
  offsets: ReminderOffset[]
}

/** Manual day-add kinds (Pull/Google events omit this). */
export type CalendarEntryKind = 'event' | 'reminder' | 'note'

export type CalendarEvent = {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  location?: string
  notes?: string
  source?: SourceKind
  sourceLabel?: string
  color: string
  /** Color category for calendar legend / filtering. */
  categoryId?: string
  /** How this row was added from day view (optional). */
  entryKind?: CalendarEntryKind
  reminderStackId: string
  /** Per-event override; if set, used instead of stack template */
  reminderOverride?: ReminderOffset[]
  createdAt: string
  /** When the user marked this event/reminder complete. */
  completedAt?: string
}

export type CandidateStatus = 'pending' | 'scheduled' | 'dismissed'

export type EventCandidate = {
  id: string
  title: string
  start: string
  end: string
  location?: string
  notes?: string
  source: SourceKind
  sourceLabel: string
  rawSnippet: string
  confidence: number
  status: CandidateStatus
  color: string
  /** Stable id from the source (Google event id, Gmail message id, …). */
  externalId?: string
  /** Recurring series id when the source expands repeat instances. */
  seriesId?: string
}

export type PetStage = 'egg' | 'hatchling' | 'cub' | 'glowfox' | 'legend'

export type PetState = {
  name: string
  eventsPulled: number
  eventsScheduled: number
  lastReactedAt?: string
}

/** How often a daily todo / template should reappear. */
export type TodoRepeat = 'none' | 'daily' | 'weekdays' | 'weekly'

/** Repeatable definition that materializes into DailyTodo rows per day. */
export type TodoTemplate = {
  id: string
  title: string
  color: string
  groupId?: string
  /** Calendar category id when shared with #30 colors. */
  categoryId?: string
  repeat: Exclude<TodoRepeat, 'none'>
  /** For weekly: 0=Sun … 6=Sat */
  repeatWeekday?: number
  active: boolean
  createdAt: string
}

/** One checkbox row on a specific local calendar day. */
export type DailyTodo = {
  id: string
  title: string
  /** Local day key yyyy-MM-dd */
  date: string
  done: boolean
  doneAt?: string
  color: string
  groupId?: string
  templateId?: string
  repeat: TodoRepeat
  repeatWeekday?: number
  createdAt: string
}

export type TaskGroupItem = {
  id: string
  title: string
  color: string
  defaultRepeat: TodoRepeat
}

export type TaskGroup = {
  id: string
  label: string
  color: string
  /** Aligns with calendar task category colors when present. */
  categoryId?: string
  items: TaskGroupItem[]
}

/** Broad feeling bucket (tap → specific feelings). */
export type FeelingCategoryId =
  | 'good'
  | 'calm'
  | 'okay'
  | 'tired'
  | 'stressed'
  | 'low'

/** 1 = drained … 5 = buzzing. */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5

/** One feeling + energy snapshot on a local calendar day. */
export type MoodCheckIn = {
  id: string
  /** Local day key yyyy-MM-dd */
  date: string
  categoryId: FeelingCategoryId
  feelingId: string
  feelingLabel: string
  energy: EnergyLevel
  createdAt: string
}

/** Weekly / monthly / yearly reflection goals. */
export type GoalPeriod = 'weekly' | 'monthly' | 'yearly'

export type Goal = {
  id: string
  period: GoalPeriod
  title: string
  /** Optional task-group link — category completions count toward this goal. */
  taskGroupId?: string
  /** Period anchor day key (week Mon / month 1st / Jan 1) as yyyy-MM-dd. */
  periodKey: string
  /** Optional completion target (todos/events in linked group). */
  targetCount?: number
  /** Prompt shown in journal / goals UI. */
  prompt: string
  createdAt: string
  archived?: boolean
}

export type JournalEntry = {
  id: string
  /** Local day key yyyy-MM-dd */
  date: string
  body: string
  goalId?: string
  /** Snapshot of the prompt answered (goal or feeling). */
  prompt?: string
  feelingCategory?: string
  feeling?: string
  keywords: string[]
  /** 1–5 energy when logged with the entry. */
  energy?: number
  createdAt: string
}

export type AppState = {
  events: CalendarEvent[]
  candidates: EventCandidate[]
  defaultStackId: string
  stacks: ReminderStack[]
  pet: PetState
  autoAddHighConfidence: boolean
  hasSeenHero: boolean
  seededAt: string
  /**
   * Fingerprints / external / series keys the user dismissed.
   * Persisted via localStorage with the rest of app state; Pull skips them.
   */
  dismissedKeys: string[]
  /** Seeded + user task groups (health, hygiene, …). */
  taskGroups: TaskGroup[]
  /** Active repeatable todo templates. */
  todoTemplates: TodoTemplate[]
  /** Per-day todo instances (including one-offs). */
  dailyTodos: DailyTodo[]
  /** W/M/Y goals (task groups may count as goals). */
  goals: Goal[]
  /** Freeform journal entries with optional goal / feeling prompts. */
  journalEntries: JournalEntry[]
  /** Feeling + energy check-ins (tint calendar days + reports). */
  moodCheckIns: MoodCheckIn[]
}

export type { SourceConnector, ConnectorPullResult } from './connectors/types'
