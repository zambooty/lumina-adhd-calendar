/**
 * ND-friendly task color categories for the dark glass calendar.
 * High luminance accents on dark backgrounds — not decorative pastels.
 * Shared with task groups / daily todos so Phase 2 colors stay in sync.
 */

export type TaskCategoryId =
  | 'health'
  | 'focus'
  | 'social'
  | 'admin'
  | 'errands'
  | 'rest'

export type TaskCategory = {
  id: TaskCategoryId
  label: string
  /** Short legend label */
  short: string
  color: string
}

export const TASK_CATEGORIES: TaskCategory[] = [
  { id: 'health', label: 'Health & care', short: 'Health', color: '#3dffd4' },
  { id: 'focus', label: 'Focus work', short: 'Focus', color: '#c8ff4d' },
  { id: 'social', label: 'People', short: 'People', color: '#ffb020' },
  { id: 'admin', label: 'Admin', short: 'Admin', color: '#4db8ff' },
  { id: 'errands', label: 'Errands', short: 'Errands', color: '#ff5c6c' },
  { id: 'rest', label: 'Rest', short: 'Rest', color: '#ff9f6b' },
]

export const DEFAULT_CATEGORY_ID: TaskCategoryId = 'admin'

export function categoryById(id: string | undefined | null): TaskCategory {
  return (
    TASK_CATEGORIES.find((c) => c.id === id) ??
    TASK_CATEGORIES.find((c) => c.id === DEFAULT_CATEGORY_ID)!
  )
}

/** Match an existing event color to a category (legacy / pulled events). */
export function categoryFromColor(color: string | undefined): TaskCategory {
  if (!color) return categoryById(DEFAULT_CATEGORY_ID)
  const exact = TASK_CATEGORIES.find(
    (c) => c.color.toLowerCase() === color.toLowerCase(),
  )
  if (exact) return exact
  return categoryById(DEFAULT_CATEGORY_ID)
}

export function resolveEventCategory(event: {
  categoryId?: string
  color: string
}): TaskCategory {
  if (event.categoryId) return categoryById(event.categoryId)
  return categoryFromColor(event.color)
}

export type ManualEntryKind = 'event' | 'reminder' | 'note'

export const MANUAL_ENTRY_KINDS: {
  id: ManualEntryKind
  label: string
  hint: string
}[] = [
  { id: 'event', label: 'Event', hint: 'Timed block on the calendar' },
  { id: 'reminder', label: 'Reminder', hint: 'A nudge at a moment' },
  { id: 'note', label: 'Note', hint: 'Park a thought on this day' },
]
