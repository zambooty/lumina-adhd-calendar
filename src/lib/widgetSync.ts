/**
 * Push pet + agenda snapshot to Android home-screen widgets via Capacitor.
 * Web / non-Android: no-op.
 */
import { registerPlugin } from '@capacitor/core'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import type {
  AppState,
  CalendarEvent,
  DailyTodo,
  PetStoreState,
} from '../types'
import { dayKey } from './dailyTodos'
import { formatDurationMinutes } from './duration'
import { isAndroidNative } from './platform'
import { ensurePetStore, equippedAccent, petWidgetLine } from './petStore'
import { petStage, petXp } from './pet'

type WidgetSyncPlugin = {
  updateWidgets(options: {
    petTitle: string
    petSubtitle: string
    petAccent: string
    agendaTitle: string
    agendaLines: string[]
  }): Promise<{ ok: boolean }>
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>('WidgetSync')

function shortWhen(iso: string): string {
  try {
    const d = parseISO(iso)
    if (isToday(d)) return format(d, 'h:mm a')
    if (isTomorrow(d)) return `Tom ${format(d, 'h:mm a')}`
    return format(d, 'MMM d · h:mm a')
  } catch {
    return ''
  }
}

function upcomingLines(events: CalendarEvent[], limit = 3): string[] {
  const now = Date.now()
  return [...events]
    .filter((e) => +new Date(e.start) >= now - 30 * 60_000)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, limit)
    .map((e) => {
      const start = +new Date(e.start)
      const end = +new Date(e.end)
      const mins = Math.max(1, Math.round((end - start) / 60_000))
      return `${shortWhen(e.start)} · ${e.title} (${formatDurationMinutes(mins)})`
    })
}

function todoLines(todos: DailyTodo[], limit = 3): string[] {
  const key = dayKey()
  return (todos ?? [])
    .filter((t) => t.date === key && !t.done)
    .slice(0, limit)
    .map((t) => `☐ ${t.title}`)
}

export function buildWidgetPayload(state: AppState): {
  petTitle: string
  petSubtitle: string
  petAccent: string
  agendaTitle: string
  agendaLines: string[]
} {
  const store: PetStoreState = ensurePetStore(state.petStore)
  const xp = petXp(state.pet)
  const stage = petStage(xp)
  const upcoming = upcomingLines(state.events ?? [])
  const todos = todoLines(state.dailyTodos ?? [])
  const agendaLines = [
    ...upcoming.map((l) => `↑ ${l}`),
    ...todos,
  ].slice(0, 5)

  return {
    petTitle: state.pet.name || 'Blink',
    petSubtitle: petWidgetLine(
      state.pet.name,
      store,
      state.pet.eventsPulled,
      state.pet.eventsScheduled,
    ).replace(`${state.pet.name} · `, `${stage} · `),
    petAccent: equippedAccent(store),
    agendaTitle: 'Upcoming · today',
    agendaLines:
      agendaLines.length > 0
        ? agendaLines
        : ['Nothing queued · Pull or add a todo'],
  }
}

export async function syncHomeWidgets(state: AppState): Promise<void> {
  if (!isAndroidNative()) return
  try {
    const payload = buildWidgetPayload(state)
    await WidgetSync.updateWidgets(payload)
  } catch {
    /* plugin missing on web / older APK — ignore */
  }
}
