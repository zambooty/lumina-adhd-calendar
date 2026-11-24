import { format } from 'date-fns'
import type { EnergyLevel, FeelingCategoryId, MoodCheckIn } from '../types'

export type FeelingOption = {
  id: string
  label: string
}

export type FeelingCategory = {
  id: FeelingCategoryId
  label: string
  hint: string
  color: string
  feelings: FeelingOption[]
}

export type EnergyOption = {
  level: EnergyLevel
  label: string
  hint: string
}

/** Broad → specific feeling taxonomy (ADHD-friendly, few taps). */
export const FEELING_CATEGORIES: FeelingCategory[] = [
  {
    id: 'good',
    label: 'Feeling good',
    hint: 'Bright side of the day',
    color: '#3dffd4',
    feelings: [
      { id: 'happy', label: 'Happy' },
      { id: 'proud', label: 'Proud' },
      { id: 'grateful', label: 'Grateful' },
      { id: 'excited', label: 'Excited' },
    ],
  },
  {
    id: 'calm',
    label: 'Calm / steady',
    hint: 'Grounded energy',
    color: '#4db8ff',
    feelings: [
      { id: 'peaceful', label: 'Peaceful' },
      { id: 'focused', label: 'Focused' },
      { id: 'content', label: 'Content' },
      { id: 'hopeful', label: 'Hopeful' },
    ],
  },
  {
    id: 'okay',
    label: 'Just okay',
    hint: 'Neither up nor down',
    color: '#c8ff4d',
    feelings: [
      { id: 'meh', label: 'Meh' },
      { id: 'neutral', label: 'Neutral' },
      { id: 'bored', label: 'Bored' },
      { id: 'restless', label: 'Restless' },
    ],
  },
  {
    id: 'tired',
    label: 'Tired / foggy',
    hint: 'Soft battery',
    color: '#ffb020',
    feelings: [
      { id: 'exhausted', label: 'Exhausted' },
      { id: 'foggy', label: 'Brain fog' },
      { id: 'drained', label: 'Drained' },
      { id: 'sleepy', label: 'Sleepy' },
    ],
  },
  {
    id: 'stressed',
    label: 'Stressed',
    hint: 'System under load',
    color: '#ff8a4c',
    feelings: [
      { id: 'anxious', label: 'Anxious' },
      { id: 'overwhelmed', label: 'Overwhelmed' },
      { id: 'worried', label: 'Worried' },
      { id: 'tense', label: 'Tense' },
    ],
  },
  {
    id: 'low',
    label: 'Having a hard time',
    hint: 'Rough stretch — still valid',
    color: '#ff5c6c',
    feelings: [
      { id: 'sad', label: 'Sad' },
      { id: 'lonely', label: 'Lonely' },
      { id: 'frustrated', label: 'Frustrated' },
      { id: 'angry', label: 'Angry' },
    ],
  },
]

export const ENERGY_LEVELS: EnergyOption[] = [
  { level: 1, label: 'Drained', hint: 'Running on empty' },
  { level: 2, label: 'Low', hint: 'Soft battery' },
  { level: 3, label: 'Steady', hint: 'Middle gear' },
  { level: 4, label: 'Up', hint: 'Ready to go' },
  { level: 5, label: 'Buzzing', hint: 'Wired / hyperfocus' },
]

export function feelingCategoryById(
  id: FeelingCategoryId | string,
): FeelingCategory {
  return (
    FEELING_CATEGORIES.find((c) => c.id === id) ?? FEELING_CATEGORIES[2]
  )
}

export function feelingLabel(
  categoryId: FeelingCategoryId | string,
  feelingId: string,
): string {
  const cat = feelingCategoryById(categoryId)
  return cat.feelings.find((f) => f.id === feelingId)?.label ?? feelingId
}

export function energyLabel(level: EnergyLevel): string {
  return ENERGY_LEVELS.find((e) => e.level === level)?.label ?? `Level ${level}`
}

/** Local day key for a check-in date. */
export function checkInDayKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

export function checkInsForDay(
  checkIns: MoodCheckIn[],
  dateKey: string,
): MoodCheckIn[] {
  return checkIns
    .filter((c) => c.date === dateKey)
    .slice()
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
}

function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return hex
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Calendar day tint from check-ins.
 * One check-in → soft wash of that category color.
 * Multiple same-day → left-to-right gradient in chronological order.
 */
export function dayTintBackground(checkIns: MoodCheckIn[]): string | undefined {
  if (!checkIns.length) return undefined
  const ordered = checkIns
    .slice()
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  const colors = ordered.map((c) => feelingCategoryById(c.categoryId).color)

  if (colors.length === 1) {
    return `linear-gradient(160deg, ${withAlpha(colors[0], 0.34)} 0%, ${withAlpha(colors[0], 0.1)} 100%)`
  }

  const stops = colors
    .map((c, i) => {
      const pct = (i / (colors.length - 1)) * 100
      return `${withAlpha(c, 0.38)} ${pct}%`
    })
    .join(', ')
  return `linear-gradient(90deg, ${stops})`
}

/** Compact map of dateKey → tint CSS for calendar grids. */
export function buildDayTintMap(
  checkIns: MoodCheckIn[],
): Record<string, string> {
  const byDay = new Map<string, MoodCheckIn[]>()
  for (const c of checkIns) {
    const list = byDay.get(c.date) ?? []
    list.push(c)
    byDay.set(c.date, list)
  }
  const out: Record<string, string> = {}
  for (const [key, list] of byDay) {
    const bg = dayTintBackground(list)
    if (bg) out[key] = bg
  }
  return out
}
