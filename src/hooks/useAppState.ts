import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMinutes, getDay, setHours, setMinutes } from 'date-fns'
import type {
  AppState,
  CalendarEntryKind,
  CalendarEvent,
  DailyTodo,
  EnergyLevel,
  EventCandidate,
  FeelingCategoryId,
  MoodCheckIn,
  ReminderOffset,
  ReminderStack,
  TaskGroupItem,
  TodoRepeat,
  TodoTemplate,
} from '../types'
import { categoryById, DEFAULT_CATEGORY_ID } from '../lib/taskCategories'
import { loadState, resetState, saveState } from '../lib/storage'
import { clearGoogleToken } from '../lib/googleAuth'
import { pullAllSources } from '../connectors'
import { uid } from '../lib/id'
import {
  dismissKeysFor,
  emptySkipStats,
  filterPulledCandidates,
  formatSkipFeedback,
  rememberDismissed,
} from '../lib/pullFilter'
import {
  cancelAllLuminaNotifications,
  installNotificationTapHandler,
  rescheduleAllEventNotifications,
  scheduleEventNotifications,
} from '../lib/localNotifications'
import { drainShareTargetOnLaunch } from '../lib/nativeCapture'
import { isNativeCapacitor } from '../lib/platform'
import {
  dayKey,
  materializeTemplates,
  parseDayKey,
} from '../lib/dailyTodos'
import { checkInDayKey } from '../lib/feelings'

export function useAppState() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [pulling, setPulling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pullStatus, setPullStatus] = useState<string | null>(null)
  const [focusEventId, setFocusEventId] = useState<string | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  // Materialize repeating templates for today (and keep list fresh across midnight).
  useEffect(() => {
    const sync = () => {
      const key = dayKey()
      setState((s) => {
        const spawned = materializeTemplates(
          s.todoTemplates ?? [],
          s.dailyTodos ?? [],
          key,
        )
        if (!spawned.length) return s
        return { ...s, dailyTodos: [...(s.dailyTodos ?? []), ...spawned] }
      })
    }
    sync()
    const id = window.setInterval(sync, 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  // Cap: notification tap → highlight event; drain share-target on launch.
  useEffect(() => {
    if (!isNativeCapacitor()) return
    void installNotificationTapHandler((eventId) => {
      setFocusEventId(eventId)
      setToast('Opened from reminder')
    })
    void drainShareTargetOnLaunch().then((added) => {
      if (added > 0) {
        setToast(
          added === 1
            ? 'Shared item queued · Pull to land it'
            : `${added} shared items queued · Pull to land them`,
        )
      }
    })
  }, [])

  const flash = useCallback((msg: string) => setToast(msg), [])

  const dismissHero = useCallback(() => {
    setState((s) => ({ ...s, hasSeenHero: true }))
  }, [])

  const scheduleCandidate = useCallback(
    (candidateId: string, stackId?: string) => {
      let scheduled: CalendarEvent | null = null
      let stacksSnap: ReminderStack[] = []
      setState((s) => {
        const cand = s.candidates.find((c) => c.id === candidateId)
        if (!cand || cand.status === 'scheduled') return s
        const event: CalendarEvent = {
          id: uid('evt'),
          title: cand.title,
          start: cand.start,
          end: cand.end,
          location: cand.location,
          notes: cand.notes ?? cand.rawSnippet,
          source: cand.source,
          sourceLabel: cand.sourceLabel,
          color: cand.color,
          reminderStackId: stackId ?? s.defaultStackId,
          createdAt: new Date().toISOString(),
        }
        scheduled = event
        stacksSnap = s.stacks
        return {
          ...s,
          events: [...s.events, event].sort(
            (a, b) => +new Date(a.start) - +new Date(b.start),
          ),
          candidates: s.candidates.map((c) =>
            c.id === candidateId ? { ...c, status: 'scheduled' as const } : c,
          ),
          pet: {
            ...s.pet,
            eventsScheduled: s.pet.eventsScheduled + 1,
          },
        }
      })
      flash('Scheduled · auto reminders on')
      if (scheduled) {
        void scheduleEventNotifications(scheduled, stacksSnap)
      }
    },
    [flash],
  )

  const dismissCandidate = useCallback((candidateId: string) => {
    setState((s) => {
      const cand = s.candidates.find((c) => c.id === candidateId)
      if (!cand) return s
      return {
        ...s,
        // Drop from inbox; remember fingerprint so Pull never re-adds it.
        candidates: s.candidates.filter((c) => c.id !== candidateId),
        dismissedKeys: rememberDismissed(
          s.dismissedKeys,
          dismissKeysFor(cand),
        ),
      }
    })
    flash('Dismissed · won’t re-pull')
  }, [flash])

  const pullSources = useCallback(async () => {
    setPulling(true)
    setPullStatus(null)
    try {
      const { candidates: found, meta } = await pullAllSources()
      let autoScheduled = 0
      let freshCount = 0
      const skipStats = emptySkipStats()
      skipStats.seriesCollapsed = meta.seriesCollapsed
      const autoEvents: CalendarEvent[] = []
      let stacksSnap: ReminderStack[] = []

      setState((s) => {
        stacksSnap = s.stacks
        const { fresh, stats } = filterPulledCandidates({
          found,
          dismissedKeys: s.dismissedKeys ?? [],
          existingCandidates: s.candidates,
          existingEvents: s.events,
        })
        // Mutate the shared bag so StrictMode double-invokes still leave
        // the last consistent counts for the status line below.
        skipStats.dismissed = stats.dismissed
        skipStats.duplicates = stats.duplicates
        skipStats.capped = stats.capped
        skipStats.seriesCollapsed =
          meta.seriesCollapsed + stats.seriesCollapsed

        const nextCandidates: EventCandidate[] = [...s.candidates]
        const nextEvents: CalendarEvent[] = [...s.events]
        let scheduled = 0
        autoEvents.length = 0

        for (const c of fresh) {
          if (s.autoAddHighConfidence && c.confidence >= 0.9) {
            const event: CalendarEvent = {
              id: uid('evt'),
              title: c.title,
              start: c.start,
              end: c.end,
              location: c.location,
              notes: c.rawSnippet,
              source: c.source,
              sourceLabel: c.sourceLabel,
              color: c.color,
              reminderStackId: s.defaultStackId,
              createdAt: new Date().toISOString(),
            }
            nextEvents.push(event)
            autoEvents.push(event)
            nextCandidates.push({ ...c, status: 'scheduled' })
            scheduled += 1
          } else {
            nextCandidates.push(c)
          }
        }

        // Capture counts for toast (updater may run twice in StrictMode —
        // last run wins; counts stay consistent with that run).
        freshCount = fresh.length
        autoScheduled = scheduled
        nextEvents.sort((a, b) => +new Date(a.start) - +new Date(b.start))

        return {
          ...s,
          dismissedKeys: s.dismissedKeys ?? [],
          candidates: nextCandidates,
          events: nextEvents,
          pet: {
            ...s.pet,
            eventsPulled: s.pet.eventsPulled + fresh.length,
            eventsScheduled: s.pet.eventsScheduled + scheduled,
          },
        }
      })

      for (const event of autoEvents) {
        void scheduleEventNotifications(event, stacksSnap)
      }

      const modeTag =
        meta.mode === 'live'
          ? 'Google live'
          : meta.mode === 'mixed'
            ? 'Google ready · demo pull'
            : 'Demo'
      const skipLine = formatSkipFeedback(skipStats)
      const nativeBits: string[] = []
      if (meta.native) {
        if (meta.native.smsAdded)
          nativeBits.push(`${meta.native.smsAdded} SMS`)
        if (meta.native.shareAdded)
          nativeBits.push(`${meta.native.shareAdded} shared`)
        if (meta.native.voicemailAdded)
          nativeBits.push(`${meta.native.voicemailAdded} voicemail`)
      }
      const nativeTag = nativeBits.length
        ? ` · native ${nativeBits.join(' + ')}`
        : ''

      const smsHint =
        meta.emptyHints.find((h) => /\bSMS\b/i.test(h)) ?? null
      const googleUnsigned = meta.errors.find((e) =>
        /not signed in/i.test(e),
      )
      // Non-Google errors still matter; unsigned Google must not hide SMS.
      const otherErrors = meta.errors.filter((e) => !/not signed in/i.test(e))

      if (freshCount > 0) {
        const base =
          autoScheduled > 0
            ? `Added ${freshCount} · auto-scheduled ${autoScheduled} high-confidence.`
            : `${freshCount} new candidate${freshCount === 1 ? '' : 's'} ready.`
        const withSkip = skipLine ? `${base} · ${skipLine}` : base
        const withGoogle =
          googleUnsigned && !meta.native?.smsAdded
            ? `${withSkip} · ${googleUnsigned}`
            : googleUnsigned && meta.native?.smsAdded
              ? `${withSkip} · Google still needs Menu → Connect`
              : withSkip
        setPullStatus(withGoogle)
        flash(
          autoScheduled > 0
            ? `${modeTag}${nativeTag} · ${freshCount} new · auto-added ${autoScheduled} · pet XP up`
            : `${modeTag}${nativeTag} · ${freshCount} new · pet XP up`,
        )
      } else if (smsHint) {
        // Permission denied / scanned-none / empty inbox — always visible.
        const status = skipLine ? `${smsHint} · ${skipLine}` : smsHint
        setPullStatus(
          googleUnsigned ? `${status} · ${googleUnsigned}` : status,
        )
        flash(
          skipLine
            ? `${modeTag}${nativeTag} · 0 new · ${skipLine}`
            : `${modeTag}${nativeTag} · 0 new · SMS`,
        )
      } else if (otherErrors.length) {
        const errLine = otherErrors[0]
        setPullStatus(skipLine ? `${errLine} · ${skipLine}` : errLine)
        flash(`${modeTag}${nativeTag} · ${errLine}`)
      } else if (googleUnsigned) {
        setPullStatus(
          skipLine ? `${googleUnsigned} · ${skipLine}` : googleUnsigned,
        )
        flash(`${modeTag}${nativeTag} · ${googleUnsigned}`)
      } else if (freshCount === 0) {
        const hint =
          skipLine ??
          meta.emptyHints[0] ??
          (meta.mode === 'live'
            ? 'No new items — inbox already has matches, or sources were empty.'
            : 'No new items this pull.')
        const status =
          skipLine && meta.emptyHints[0]
            ? `${skipLine}. ${meta.emptyHints[0]}`
            : hint
        setPullStatus(status)
        flash(
          skipLine
            ? `${modeTag}${nativeTag} · 0 new · ${skipLine}`
            : `${modeTag}${nativeTag} · 0 new`,
        )
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Pull failed unexpectedly.'
      setPullStatus(message)
      flash(`Pull failed · ${message}`)
    } finally {
      setPulling(false)
    }
  }, [flash])

  const setDefaultStack = useCallback((stackId: string) => {
    setState((s) => ({ ...s, defaultStackId: stackId }))
  }, [])

  const updateStack = useCallback((stack: ReminderStack) => {
    setState((s) => {
      const next = {
        ...s,
        stacks: s.stacks.map((st) => (st.id === stack.id ? stack : st)),
      }
      void rescheduleAllEventNotifications(next.events, next.stacks)
      return next
    })
  }, [])

  const setEventStack = useCallback((eventId: string, stackId: string) => {
    setState((s) => {
      const nextEvents = s.events.map((e) =>
        e.id === eventId
          ? { ...e, reminderStackId: stackId, reminderOverride: undefined }
          : e,
      )
      const event = nextEvents.find((e) => e.id === eventId)
      if (event) void scheduleEventNotifications(event, s.stacks)
      return { ...s, events: nextEvents }
    })
  }, [])

  const setEventCategory = useCallback((eventId: string, categoryId: string) => {
    const cat = categoryById(categoryId)
    setState((s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === eventId
          ? { ...e, categoryId: cat.id, color: cat.color }
          : e,
      ),
    }))
  }, [])

  const addManualEntry = useCallback(
    (input: {
      title: string
      start: string
      end: string
      kind: CalendarEntryKind
      categoryId?: string
      notes?: string
    }): string => {
      const cat = categoryById(input.categoryId ?? DEFAULT_CATEGORY_ID)
      const title = input.title.trim() || (
        input.kind === 'note'
          ? 'Note'
          : input.kind === 'reminder'
            ? 'Reminder'
            : 'Event'
      )
      const eventId = uid('evt')
      const bag: { event: CalendarEvent | null; stacks: ReminderStack[] } = {
        event: null,
        stacks: [],
      }
      setState((s) => {
        const event: CalendarEvent = {
          id: eventId,
          title,
          start: input.start,
          end: input.end,
          notes: input.notes,
          color: cat.color,
          categoryId: cat.id,
          entryKind: input.kind,
          sourceLabel:
            input.kind === 'note'
              ? 'Note'
              : input.kind === 'reminder'
                ? 'Reminder'
                : 'Event',
          reminderStackId: s.defaultStackId,
          createdAt: new Date().toISOString(),
        }
        bag.event = event
        bag.stacks = s.stacks
        return {
          ...s,
          events: [...s.events, event].sort(
            (a, b) => +new Date(a.start) - +new Date(b.start),
          ),
          pet: {
            ...s.pet,
            eventsScheduled: s.pet.eventsScheduled + 1,
          },
        }
      })
      flash(
        input.kind === 'note'
          ? 'Note parked on the day'
          : input.kind === 'reminder'
            ? 'Reminder set · stack attached'
            : 'Event added · stack attached',
      )
      if (input.kind !== 'note' && bag.event) {
        void scheduleEventNotifications(bag.event, bag.stacks)
      }
      return eventId
    },
    [flash],
  )

  const setEventOverride = useCallback(
    (eventId: string, offsets: ReminderOffset[] | undefined) => {
      setState((s) => {
        const nextEvents = s.events.map((e) =>
          e.id === eventId ? { ...e, reminderOverride: offsets } : e,
        )
        const event = nextEvents.find((e) => e.id === eventId)
        if (event) void scheduleEventNotifications(event, s.stacks)
        return { ...s, events: nextEvents }
      })
    },
    [],
  )

  const toggleAutoAdd = useCallback(() => {
    setState((s) => ({
      ...s,
      autoAddHighConfidence: !s.autoAddHighConfidence,
    }))
  }, [])

  const petReact = useCallback(() => {
    setState((s) => ({
      ...s,
      pet: { ...s.pet, lastReactedAt: new Date().toISOString() },
    }))
  }, [])

  const hardReset = useCallback(() => {
    clearGoogleToken()
    setState((s) => {
      void cancelAllLuminaNotifications(s.events, s.stacks)
      return resetState()
    })
    setPullStatus(null)
    flash('Cleared · empty calendar & inbox · Google disconnected')
  }, [flash])

  const notifyCaptureImported = useCallback(
    (added: number) => {
      flash(
        added === 1
          ? '1 item queued · Pull from sources · pet XP on pull'
          : `${added} items queued · Pull from sources · pet XP on pull`,
      )
    },
    [flash],
  )

  const clearFocusEvent = useCallback(() => setFocusEventId(null), [])

  const ensureDayTodos = useCallback((dateKey?: string) => {
    const key = dateKey ?? dayKey()
    setState((s) => {
      const spawned = materializeTemplates(
        s.todoTemplates ?? [],
        s.dailyTodos ?? [],
        key,
      )
      if (!spawned.length) return s
      return { ...s, dailyTodos: [...(s.dailyTodos ?? []), ...spawned] }
    })
  }, [])

  const addDailyTodo = useCallback(
    (input: {
      title: string
      date?: string
      color?: string
      groupId?: string
      repeat?: TodoRepeat
      repeatWeekday?: number
    }) => {
      const title = input.title.trim()
      if (!title) return
      const date = input.date ?? dayKey()
      const color = input.color ?? categoryById('admin').color
      const repeat = input.repeat ?? 'none'
      const weekday = input.repeatWeekday ?? getDay(parseDayKey(date))
      const now = new Date().toISOString()

      setState((s) => {
        let templates = s.todoTemplates ?? []
        let templateId: string | undefined
        if (repeat !== 'none') {
          const tpl: TodoTemplate = {
            id: uid('ttpl'),
            title,
            color,
            groupId: input.groupId,
            repeat,
            repeatWeekday: repeat === 'weekly' ? weekday : undefined,
            active: true,
            createdAt: now,
          }
          templates = [...templates, tpl]
          templateId = tpl.id
        }
        const todo: DailyTodo = {
          id: uid('todo'),
          title,
          date,
          done: false,
          color,
          groupId: input.groupId,
          templateId,
          repeat,
          repeatWeekday: repeat === 'weekly' ? weekday : undefined,
          createdAt: now,
        }
        return {
          ...s,
          todoTemplates: templates,
          dailyTodos: [...(s.dailyTodos ?? []), todo],
        }
      })
      flash(repeat === 'none' ? 'Added to today' : `Added · repeats ${repeat}`)
    },
    [flash],
  )

  const toggleDailyTodo = useCallback((todoId: string) => {
    setState((s) => ({
      ...s,
      dailyTodos: (s.dailyTodos ?? []).map((t) => {
        if (t.id !== todoId) return t
        const done = !t.done
        return {
          ...t,
          done,
          doneAt: done ? new Date().toISOString() : undefined,
        }
      }),
      pet: (() => {
        const t = (s.dailyTodos ?? []).find((x) => x.id === todoId)
        if (!t || t.done) return s.pet
        // Completing (not un-completing) nudges pet XP via scheduled counter lightly
        return {
          ...s.pet,
          eventsScheduled: s.pet.eventsScheduled + 1,
          lastReactedAt: new Date().toISOString(),
        }
      })(),
    }))
  }, [])

  const removeDailyTodo = useCallback((todoId: string) => {
    setState((s) => ({
      ...s,
      dailyTodos: (s.dailyTodos ?? []).filter((t) => t.id !== todoId),
    }))
    flash('Removed from list')
  }, [flash])

  const setTodoRepeat = useCallback(
    (todoId: string, repeat: TodoRepeat) => {
      setState((s) => {
        const todo = (s.dailyTodos ?? []).find((t) => t.id === todoId)
        if (!todo) return s
        const weekday = todo.repeatWeekday ?? getDay(parseDayKey(todo.date))
        let templates = [...(s.todoTemplates ?? [])]
        let templateId = todo.templateId

        if (repeat === 'none') {
          if (templateId) {
            templates = templates.map((tpl) =>
              tpl.id === templateId ? { ...tpl, active: false } : tpl,
            )
          }
          templateId = undefined
        } else if (templateId) {
          templates = templates.map((tpl) =>
            tpl.id === templateId
              ? {
                  ...tpl,
                  active: true,
                  repeat,
                  repeatWeekday: repeat === 'weekly' ? weekday : undefined,
                  title: todo.title,
                  color: todo.color,
                }
              : tpl,
          )
        } else {
          const tpl: TodoTemplate = {
            id: uid('ttpl'),
            title: todo.title,
            color: todo.color,
            groupId: todo.groupId,
            repeat,
            repeatWeekday: repeat === 'weekly' ? weekday : undefined,
            active: true,
            createdAt: new Date().toISOString(),
          }
          templates = [...templates, tpl]
          templateId = tpl.id
        }

        return {
          ...s,
          todoTemplates: templates,
          dailyTodos: (s.dailyTodos ?? []).map((t) =>
            t.id === todoId
              ? {
                  ...t,
                  repeat,
                  templateId,
                  repeatWeekday: repeat === 'weekly' ? weekday : undefined,
                }
              : t,
          ),
        }
      })
      flash(repeat === 'none' ? 'One-time only' : `Repeats ${repeat}`)
    },
    [flash],
  )

  const pullGroupItemToDaily = useCallback(
    (groupId: string, item: TaskGroupItem, date?: string) => {
      addDailyTodo({
        title: item.title,
        date: date ?? dayKey(),
        color: item.color,
        groupId,
        repeat: item.defaultRepeat,
        repeatWeekday:
          item.defaultRepeat === 'weekly'
            ? getDay(parseDayKey(date ?? dayKey()))
            : undefined,
      })
    },
    [addDailyTodo],
  )

  const pullGroupItemToCalendar = useCallback(
    (groupId: string, item: TaskGroupItem, date?: string) => {
      const key = date ?? dayKey()
      const day = parseDayKey(key)
      const start = setMinutes(setHours(day, 9), 0)
      const end = addMinutes(start, 30)
      let created: CalendarEvent | null = null
      let stacksSnap: ReminderStack[] = []

      setState((s) => {
        stacksSnap = s.stacks
        const group = (s.taskGroups ?? []).find((g) => g.id === groupId)
        const cat = categoryById(group?.categoryId)
        const event: CalendarEvent = {
          id: uid('evt'),
          title: item.title,
          start: start.toISOString(),
          end: end.toISOString(),
          notes: group ? `From task group · ${group.label}` : 'From task group',
          color: item.color || cat.color,
          categoryId: cat.id,
          entryKind: 'event',
          sourceLabel: group ? `Task group · ${group.label}` : 'Task group',
          reminderStackId: s.defaultStackId,
          createdAt: new Date().toISOString(),
        }
        created = event
        return {
          ...s,
          events: [...s.events, event].sort(
            (a, b) => +new Date(a.start) - +new Date(b.start),
          ),
          pet: {
            ...s.pet,
            eventsScheduled: s.pet.eventsScheduled + 1,
          },
        }
      })
      flash(`On calendar · ${item.title}`)
      if (created) void scheduleEventNotifications(created, stacksSnap)
    },
    [flash],
  )

  const addMoodCheckIn = useCallback(
    (input: {
      categoryId: FeelingCategoryId
      feelingId: string
      feelingLabel: string
      energy: EnergyLevel
      date?: string
    }) => {
      const date = input.date ?? checkInDayKey()
      const entry: MoodCheckIn = {
        id: uid('mood'),
        date,
        categoryId: input.categoryId,
        feelingId: input.feelingId,
        feelingLabel: input.feelingLabel,
        energy: input.energy,
        createdAt: new Date().toISOString(),
      }
      setState((s) => ({
        ...s,
        moodCheckIns: [...(s.moodCheckIns ?? []), entry],
        pet: {
          ...s.pet,
          eventsScheduled: s.pet.eventsScheduled + 1,
          lastReactedAt: new Date().toISOString(),
        },
      }))
      flash(`Feeling logged · ${input.feelingLabel}`)
    },
    [flash],
  )

  const pendingCandidates = useMemo(
    () => state.candidates.filter((c) => c.status === 'pending'),
    [state.candidates],
  )

  const upcomingEvents = useMemo(
    () =>
      [...state.events].sort(
        (a, b) => +new Date(a.start) - +new Date(b.start),
      ),
    [state.events],
  )

  return {
    state,
    pulling,
    toast,
    pullStatus,
    pendingCandidates,
    upcomingEvents,
    focusEventId,
    clearFocusEvent,
    dismissHero,
    scheduleCandidate,
    dismissCandidate,
    pullSources,
    setDefaultStack,
    updateStack,
    setEventStack,
    setEventCategory,
    addManualEntry,
    setEventOverride,
    toggleAutoAdd,
    petReact,
    hardReset,
    notifyCaptureImported,
    ensureDayTodos,
    addDailyTodo,
    toggleDailyTodo,
    removeDailyTodo,
    setTodoRepeat,
    pullGroupItemToDaily,
    pullGroupItemToCalendar,
    addMoodCheckIn,
  }
}
