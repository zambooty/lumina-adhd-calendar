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
  reminderStackId: string
  /** Per-event override; if set, used instead of stack template */
  reminderOverride?: ReminderOffset[]
  createdAt: string
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
}

export type { SourceConnector, ConnectorPullResult } from './connectors/types'
