import type { TaskGroup, TodoRepeat } from '../types'
import { categoryById } from './taskCategories'
import { uid } from './id'

/** Seed group ids — extensible; user state may add more later. */
export type SeedGroupId =
  | 'health'
  | 'hygiene'
  | 'fitness'
  | 'cleaning'
  | 'mental-health'
  | 'journaling'

type SeedItem = {
  title: string
  defaultRepeat: TodoRepeat
}

type SeedDef = {
  id: SeedGroupId
  label: string
  /** Calendar category color to share */
  categoryId: string
  items: SeedItem[]
}

const SEED_DEFS: SeedDef[] = [
  {
    id: 'health',
    label: 'Health',
    categoryId: 'health',
    items: [
      { title: 'Take meds', defaultRepeat: 'daily' },
      { title: 'Drink water', defaultRepeat: 'daily' },
      { title: 'Book / keep appointment', defaultRepeat: 'none' },
    ],
  },
  {
    id: 'hygiene',
    label: 'Hygiene',
    categoryId: 'health',
    items: [
      { title: 'Brush teeth', defaultRepeat: 'daily' },
      { title: 'Shower', defaultRepeat: 'daily' },
      { title: 'Skincare / face wash', defaultRepeat: 'daily' },
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    categoryId: 'focus',
    items: [
      { title: 'Move body 20 min', defaultRepeat: 'daily' },
      { title: 'Stretch', defaultRepeat: 'weekdays' },
      { title: 'Walk outside', defaultRepeat: 'none' },
    ],
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    categoryId: 'errands',
    items: [
      { title: 'Dishes', defaultRepeat: 'daily' },
      { title: 'Tidy one surface', defaultRepeat: 'daily' },
      { title: 'Laundry load', defaultRepeat: 'weekly' },
    ],
  },
  {
    id: 'mental-health',
    label: 'Mental health',
    categoryId: 'social',
    items: [
      { title: 'Breathing / ground', defaultRepeat: 'daily' },
      { title: 'Reach out to someone', defaultRepeat: 'weekly' },
      { title: 'Therapy homework', defaultRepeat: 'none' },
    ],
  },
  {
    id: 'journaling',
    label: 'Journaling',
    categoryId: 'rest',
    items: [
      { title: 'Morning brain dump', defaultRepeat: 'daily' },
      { title: 'Evening wind-down note', defaultRepeat: 'daily' },
      { title: 'Gratitudes (3)', defaultRepeat: 'weekdays' },
    ],
  },
]

export function createSeedTaskGroups(): TaskGroup[] {
  return SEED_DEFS.map((def) => {
    const cat = categoryById(def.categoryId)
    return {
      id: def.id,
      label: def.label,
      color: cat.color,
      categoryId: cat.id,
      items: def.items.map((item) => ({
        id: uid('tgi'),
        title: item.title,
        color: cat.color,
        defaultRepeat: item.defaultRepeat,
      })),
    }
  })
}

/** Merge seed groups into persisted state without wiping user-added groups/items. */
export function ensureTaskGroups(existing: TaskGroup[] | undefined): TaskGroup[] {
  const seeds = createSeedTaskGroups()
  if (!existing?.length) return seeds

  const byId = new Map(existing.map((g) => [g.id, g]))
  const merged: TaskGroup[] = []

  for (const seed of seeds) {
    const cur = byId.get(seed.id)
    if (!cur) {
      merged.push(seed)
      continue
    }
    // Keep user items; ensure seed titles that vanished can be re-added only if empty group
    merged.push({
      ...seed,
      ...cur,
      color: cur.color || seed.color,
      categoryId: cur.categoryId || seed.categoryId,
      items: cur.items?.length ? cur.items : seed.items,
    })
    byId.delete(seed.id)
  }

  // Preserve any custom groups the user may have added
  for (const extra of byId.values()) {
    merged.push(extra)
  }
  return merged
}

export function groupById(
  groups: TaskGroup[],
  id: string | undefined | null,
): TaskGroup | undefined {
  if (!id) return undefined
  return groups.find((g) => g.id === id)
}
