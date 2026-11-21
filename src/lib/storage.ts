import type { AppState } from '../types'
import { createEmptyState } from './seed'

/** v2 drops auto-seeded demo appointments so live Google tests start clean. */
const KEY = 'lumen_adhd_companion_v2'
const LEGACY_KEYS = ['lumen_adhd_companion_v1']

function wipeLegacyKeys(): void {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
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
    return JSON.parse(raw) as AppState
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
