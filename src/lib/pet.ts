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
  { title: string; blurb: string; vibe: string }
> = {
  egg: {
    title: 'Sassy Egg',
    blurb: 'Don’t just stare. Pull something.',
    vibe: 'Judging you gently… for now.',
  },
  hatchling: {
    title: 'Chaos Chick',
    blurb: 'Big eyes. Bigger calendar opinions.',
    vibe: 'Already side-eyeing your inbox.',
  },
  cub: {
    title: 'Neon Cub',
    blurb: 'Schedule it or I will sass you.',
    vibe: 'Bounce mode: permanently on.',
  },
  glowfox: {
    title: 'Glowfox Diva',
    blurb: 'Reminder stacks? Iconic. You’re welcome.',
    vibe: 'Main-character energy unlocked.',
  },
  legend: {
    title: 'Time Legend',
    blurb: 'You wrangled time. I look fabulous.',
    vibe: 'Peak sparkle. Absolute menace.',
  },
}

/** Tap / hover quips — cute + sassy personality. */
export const PET_QUIPS: Record<PetStage, string[]> = {
  egg: [
    'crack jokes, not plans',
    'warm me with a pull',
    'I’m egg-stra judgmental',
    'hatch fees: one appointment',
    'boop the shell, coward',
  ],
  hatchling: [
    'excuse me, that was late',
    'eyes bigger than my calendar',
    'feed me events pls',
    'chirp = schedule it',
    'I saw that dismiss… rude',
  ],
  cub: [
    'cute AND correct',
    'stack those reminders, bestie',
    'I bounce, you book',
    'don’t test me before coffee',
    'auto-add or suffer',
  ],
  glowfox: [
    'main character energy',
    'your inbox fears me',
    'glow up = pull up',
    'sass level: legendary-adjacent',
    'I ate the chaos for lunch',
  ],
  legend: [
    'time bends for us',
    'bow to the calendar fox',
    'XP? More like X-tra pretty',
    'I invented leave-now',
    'still cuter than your backlog',
  ],
}
