import type { PetStage, PetState } from '../types'

export type PetGrowthKind =
  | 'pull'
  | 'schedule'
  | 'task'
  | 'journal'
  | 'mood'

/** Fill missing counters for older persisted pets. */
export function normalizePet(raw: Partial<PetState> | undefined | null): PetState {
  return {
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name : 'Blink',
    eventsPulled: num(raw?.eventsPulled),
    eventsScheduled: num(raw?.eventsScheduled),
    tasksCompleted: num(raw?.tasksCompleted),
    journalsLogged: num(raw?.journalsLogged),
    moodsLogged: num(raw?.moodsLogged),
    lastReactedAt: raw?.lastReactedAt,
    lastSpokeAt: raw?.lastSpokeAt,
    lastSpeech: raw?.lastSpeech,
  }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/** XP = pulls + schedules + tasks + journals + moods. */
export function petXp(pet: PetState): number {
  const p = normalizePet(pet)
  return (
    p.eventsPulled +
    p.eventsScheduled +
    p.tasksCompleted +
    p.journalsLogged +
    p.moodsLogged
  )
}

export function petStage(xp: number): PetStage {
  if (xp >= 24) return 'legend'
  if (xp >= 14) return 'glowfox'
  if (xp >= 8) return 'cub'
  if (xp >= 3) return 'hatchling'
  return 'egg'
}

export function xpForNextStage(xp: number): {
  current: number
  next: number
  progress: number
} {
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

/** Apply growth from a user action. */
export function bumpPetGrowth(
  pet: PetState,
  kind: PetGrowthKind,
  amount = 1,
): PetState {
  const p = normalizePet(pet)
  const n = Math.max(1, Math.floor(amount))
  const next = { ...p, lastReactedAt: new Date().toISOString() }
  switch (kind) {
    case 'pull':
      next.eventsPulled += n
      break
    case 'schedule':
      next.eventsScheduled += n
      break
    case 'task':
      next.tasksCompleted += n
      break
    case 'journal':
      next.journalsLogged += n
      break
    case 'mood':
      next.moodsLogged += n
      break
  }
  return next
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

/** Short tap / hover quips — cute + sassy. */
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

/**
 * Longer speech lines for the pet screen — motivational / cute / sassy.
 * Auto-cycled while the screen is open.
 */
export const PET_SPEECH: Record<PetStage, string[]> = {
  egg: [
    'Hey. I’m still an egg and somehow more organized than you.',
    'One tiny pull and I’ll crack a smile. Maybe.',
    'You don’t have to do everything — just the next soft thing.',
    'Warm me up with a mood check-in. I’m cold and judgmental.',
    'ADHD brain? Same. Let’s make the calendar hold the chaos.',
  ],
  hatchling: [
    'Chirp! That task you finished? Absolute chef’s kiss.',
    'Journaling counts. Feelings count. You count. I’m counting XP.',
    'You’re not behind — you’re hatching. Dramatically.',
    'Left-swipe the junk. Right-swipe the life. I’m watching.',
    'Soft reminder: water, stretch, and don’t ghost your dentist.',
  ],
  cub: [
    'Look at you completing things. I’m bouncing about it.',
    'Mood logged = glow unlocked. Keep feeding me honesty.',
    'Sassy but supportive: open the menu, pick one todo, win.',
    'Pull, schedule, journal — that’s my whole personality now.',
    'You’re doing the hard soft work. Cub approved.',
  ],
  glowfox: [
    'Main-character calendar energy. Don’t dim it.',
    'I grow when you care for yourself. Gross. Beautiful. Continue.',
    'Your future self already high-fived this check-in.',
    'Chaos is optional. Reminder stacks are fashion.',
    'Glowfox tip: done is cuter than perfect.',
  ],
  legend: [
    'Time Legend reporting: you made the day bend a little.',
    'I’ve seen empires fall to unread email. Not us. Not today.',
    'Peak sparkle. Peak sass. Peak “I journaled and lived”.',
    'Widgets and skins can wait — this bond is already iconic.',
    'Bow once, then go finish one more tiny win. I’ll clap.',
  ],
}

export function pickSpeech(stage: PetStage, exclude?: string | null): string {
  const lines = PET_SPEECH[stage]
  if (lines.length === 1) return lines[0]
  let pick = lines[Math.floor(Math.random() * lines.length)]
  if (exclude && lines.length > 1) {
    let guard = 0
    while (pick === exclude && guard < 6) {
      pick = lines[Math.floor(Math.random() * lines.length)]
      guard += 1
    }
  }
  return pick
}

export function pickQuip(stage: PetStage): string {
  const quips = PET_QUIPS[stage]
  return quips[Math.floor(Math.random() * quips.length)]
}

export function growthBreakdown(pet: PetState): {
  key: PetGrowthKind
  label: string
  value: number
}[] {
  const p = normalizePet(pet)
  return [
    { key: 'pull', label: 'Pulled', value: p.eventsPulled },
    { key: 'schedule', label: 'Scheduled', value: p.eventsScheduled },
    { key: 'task', label: 'Tasks', value: p.tasksCompleted },
    { key: 'journal', label: 'Journal', value: p.journalsLogged },
    { key: 'mood', label: 'Moods', value: p.moodsLogged },
  ]
}
