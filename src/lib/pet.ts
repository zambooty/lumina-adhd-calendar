import type { PetStage, PetState } from '../types'

/** XP = pulled + scheduled. Stages unlock as XP grows. */
export function petXp(pet: PetState): number {
  return pet.eventsPulled + pet.eventsScheduled
}

export function petStage(xp: number): PetStage {
  if (xp >= 24) return 'legend'
  if (xp >= 14) return 'glowfox'
  if (xp >= 8) return 'cub'
  if (xp >= 3) return 'hatchling'
  return 'egg'
}

export function xpForNextStage(xp: number): { current: number; next: number; progress: number } {
  const thresholds = [0, 3, 8, 14, 24]
  let next = thresholds[thresholds.length - 1]
  let current = 0
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (xp < thresholds[i + 1]) {
      current = thresholds[i]
      next = thresholds[i + 1]
      break
    }
    current = thresholds[i + 1]
  }
  if (xp >= 24) {
    return { current: 24, next: 24, progress: 1 }
  }
  const progress = (xp - current) / (next - current)
  return { current, next, progress: Math.min(1, Math.max(0, progress)) }
}

export const STAGE_COPY: Record<
  PetStage,
  { title: string; blurb: string; emoji: string }
> = {
  egg: {
    title: 'Glow Egg',
    blurb: 'Warm it up by pulling appointments.',
    emoji: '🥚',
  },
  hatchling: {
    title: 'Hatchling',
    blurb: 'Tiny paws, big calendar energy.',
    emoji: '🐣',
  },
  cub: {
    title: 'Neon Cub',
    blurb: 'Scheduling makes it stronger.',
    emoji: '🦊',
  },
  glowfox: {
    title: 'Glowfox',
    blurb: 'Reminder stacks? Pure rocket fuel.',
    emoji: '✨',
  },
  legend: {
    title: 'Legend',
    blurb: 'Time-wrangling myth. You’re crushing it.',
    emoji: '🌟',
  },
}
