import type { AppState } from '../types'
import { createSeedState } from './seed'

const KEY = 'lumen_adhd_companion_v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const seeded = createSeedState()
      saveState(seeded)
      return seeded
    }
    return JSON.parse(raw) as AppState
  } catch {
    const seeded = createSeedState()
    saveState(seeded)
    return seeded
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function resetState(): AppState {
  const seeded = createSeedState()
  saveState(seeded)
  return seeded
}
