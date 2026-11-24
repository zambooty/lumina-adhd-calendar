import type { AppState, ReminderStack } from '../types'
import { ensurePetStore } from './petStore'
import { AUTO_REMINDER_PRESETS } from './reminders'
import { createEmptyState } from './seed'
import { dismissKeysFor, rememberDismissed } from './pullFilter'
import { ensureTaskGroups } from './taskGroups'

/** v2 drops auto-seeded demo appointments so live Google tests start clean. */
const KEY = 'lumen_adhd_companion_v2'
const LEGACY_KEYS = ['lumen_adhd_companion_v1']

const PRESET_NAMES = Object.fromEntries(
  AUTO_REMINDER_PRESETS.map((p) => [p.id, p.label]),
) as Record<string, string>

function wipeLegacyKeys(): void {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

function friendlyStacks(stacks: ReminderStack[] | undefined): ReminderStack[] {
  return (stacks ?? []).map((s) => {
    const name = PRESET_NAMES[s.id]
    return name && s.name !== name ? { ...s, name } : s
  })
}

function normalizeState(raw: AppState): AppState {
  const fromStatus = (raw.candidates ?? [])
    .filter((c) => c.status === 'dismissed')
    .flatMap((c) => dismissKeysFor(c))

  return {
    ...raw,
    stacks: friendlyStacks(raw.stacks),
    dismissedKeys: rememberDismissed(
      Array.isArray(raw.dismissedKeys) ? raw.dismissedKeys : [],
      fromStatus,
    ),
    taskGroups: ensureTaskGroups(raw.taskGroups),
    todoTemplates: Array.isArray(raw.todoTemplates) ? raw.todoTemplates : [],
    dailyTodos: Array.isArray(raw.dailyTodos) ? raw.dailyTodos : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    journalEntries: Array.isArray(raw.journalEntries) ? raw.journalEntries : [],
    moodCheckIns: Array.isArray(raw.moodCheckIns) ? raw.moodCheckIns : [],
    petStore: ensurePetStore(raw.petStore),
  }
}

export function loadState(): AppState {
  wipeLegacyKeys()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const empty = createEmptyState()
      saveState(empty)
      return empty
    }
    return normalizeState(JSON.parse(raw) as AppState)
  } catch {
    const empty = createEmptyState()
    saveState(empty)
    return empty
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

/** Clear calendar + inbox without re-injecting fake appointments. */
export function resetState(): AppState {
  wipeLegacyKeys()
  const empty = createEmptyState()
  // Keep hero dismissed after an intentional reset so the user stays in-app.
  empty.hasSeenHero = true
  saveState(empty)
  return empty
}
