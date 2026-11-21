/**
 * ADHD reminder stacks → OS local notifications (Capacitor Android).
 * No-ops on web. Dark-friendly copy; tap opens the app (event deep-link when practical).
 */
import type { CalendarEvent, ReminderOffset, ReminderStack } from '../types'
import { isAndroidNative, isNativeCapacitor } from './platform'

const CHANNEL_ID = 'lumina_reminders'
const CHANNEL_NAME = 'LUMINA reminders'

/** Stable notification id from event + offset (Android requires int32). */
export function notificationIdFor(eventId: string, offsetId: string): number {
  const raw = `${eventId}:${offsetId}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0
  }
  // Keep positive and away from 0.
  return (Math.abs(hash) % 2_000_000_000) + 1
}

function offsetsForEvent(
  event: CalendarEvent,
  stacks: ReminderStack[],
): ReminderOffset[] {
  if (event.reminderOverride?.length) return event.reminderOverride
  const stack =
    stacks.find((s) => s.id === event.reminderStackId) ?? stacks[0]
  return stack?.offsets ?? []
}

function darkFriendlyBody(event: CalendarEvent, offset: ReminderOffset): string {
  const when = new Date(event.start)
  const time = when.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const where = event.location ? ` · ${event.location}` : ''
  return `${offset.label} · ${time}${where}`
}

async function ensureChannel(): Promise<void> {
  if (!isAndroidNative()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: CHANNEL_NAME,
    description: 'ADHD reminder stacks for scheduled events',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#7DD3FC',
  })
}

/** Request POST_NOTIFICATIONS on API 33+; returns whether we may schedule. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNativeCapacitor()) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let status = await LocalNotifications.checkPermissions()
    if (status.display !== 'granted') {
      status = await LocalNotifications.requestPermissions()
    }
    if (status.display === 'granted') {
      await ensureChannel()
      return true
    }
    return false
  } catch (err) {
    console.warn('Local notification permission failed', err)
    return false
  }
}

export async function cancelEventNotifications(
  event: CalendarEvent,
  stacks: ReminderStack[],
): Promise<void> {
  if (!isNativeCapacitor()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const offsets = offsetsForEvent(event, stacks)
    const notifications = offsets.map((o) => ({
      id: notificationIdFor(event.id, o.id),
    }))
    if (notifications.length) {
      await LocalNotifications.cancel({ notifications })
    }
  } catch (err) {
    console.warn('cancelEventNotifications', err)
  }
}

/** Schedule one OS notification per reminder-stack offset (future fire times only). */
export async function scheduleEventNotifications(
  event: CalendarEvent,
  stacks: ReminderStack[],
): Promise<number> {
  if (!isNativeCapacitor()) return 0
  const allowed = await ensureNotificationPermission()
  if (!allowed) return 0

  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await cancelEventNotifications(event, stacks)

  const startMs = +new Date(event.start)
  const now = Date.now()
  const offsets = offsetsForEvent(event, stacks)
  const notifications = offsets
    .map((offset) => {
      const at = startMs - offset.minutesBefore * 60_000
      if (!Number.isFinite(at) || at <= now + 5_000) return null
      return {
        id: notificationIdFor(event.id, offset.id),
        title: event.title || 'LUMINA reminder',
        body: darkFriendlyBody(event, offset),
        schedule: { at: new Date(at), allowWhileIdle: true },
        channelId: CHANNEL_ID,
        extra: {
          eventId: event.id,
          offsetId: offset.id,
        },
        // Small icon is configured in capacitor.config / Android resources.
      }
    })
    .filter((n): n is NonNullable<typeof n> => n != null)

  if (!notifications.length) return 0
  await LocalNotifications.schedule({ notifications })
  return notifications.length
}

/** Reschedule every event (after stack edits / reset). */
export async function rescheduleAllEventNotifications(
  events: CalendarEvent[],
  stacks: ReminderStack[],
): Promise<void> {
  if (!isNativeCapacitor()) return
  for (const event of events) {
    await scheduleEventNotifications(event, stacks)
  }
}

/** Cancel everything we know about (hard reset). */
export async function cancelAllLuminaNotifications(
  events: CalendarEvent[],
  stacks: ReminderStack[],
): Promise<void> {
  if (!isNativeCapacitor()) return
  for (const event of events) {
    await cancelEventNotifications(event, stacks)
  }
}

/** Tap notification → navigate to event hash when practical. */
export async function installNotificationTapHandler(
  onEvent: (eventId: string) => void,
): Promise<void> {
  if (!isNativeCapacitor()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const extra = action.notification.extra as
          | { eventId?: string }
          | undefined
        const eventId = extra?.eventId
        if (eventId) onEvent(eventId)
      },
    )
  } catch (err) {
    console.warn('notification tap handler', err)
  }
}
