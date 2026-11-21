import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AppState,
  CalendarEvent,
  EventCandidate,
  ReminderOffset,
  ReminderStack,
} from '../types'
import { loadState, resetState, saveState } from '../lib/storage'
import { pullAllSources } from '../connectors'
import { uid } from '../lib/id'

export function useAppState() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [pulling, setPulling] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pullStatus, setPullStatus] = useState<string | null>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  const flash = useCallback((msg: string) => setToast(msg), [])

  const dismissHero = useCallback(() => {
    setState((s) => ({ ...s, hasSeenHero: true }))
  }, [])

  const scheduleCandidate = useCallback(
    (candidateId: string, stackId?: string) => {
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
      flash('Scheduled · reminder stack attached')
    },
    [flash],
  )

  const dismissCandidate = useCallback((candidateId: string) => {
    setState((s) => ({
      ...s,
      candidates: s.candidates.map((c) =>
        c.id === candidateId ? { ...c, status: 'dismissed' as const } : c,
      ),
    }))
  }, [])

  const pullSources = useCallback(async () => {
    setPulling(true)
    setPullStatus(null)
    try {
      const { candidates: found, meta } = await pullAllSources()
      let autoScheduled = 0
      let freshCount = 0

      setState((s) => {
        const existingKeys = new Set([
          ...s.candidates.map((c) => `${c.title}|${c.start}`),
          ...s.events.map((e) => `${e.title}|${e.start}`),
        ])
        const fresh = found.filter(
          (c) => !existingKeys.has(`${c.title}|${c.start}`),
        )
        const nextCandidates: EventCandidate[] = [...s.candidates]
        const nextEvents: CalendarEvent[] = [...s.events]
        let scheduled = 0

        for (const c of fresh) {
          if (s.autoAddHighConfidence && c.confidence >= 0.9) {
            nextEvents.push({
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
            })
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
          candidates: nextCandidates,
          events: nextEvents,
          pet: {
            ...s.pet,
            eventsPulled: s.pet.eventsPulled + fresh.length,
            eventsScheduled: s.pet.eventsScheduled + scheduled,
          },
        }
      })

      const modeTag =
        meta.mode === 'live'
          ? 'Google live'
          : meta.mode === 'mixed'
            ? 'Google ready · demo pull'
            : 'Demo'

      if (meta.errors.length) {
        const errLine = meta.errors[0]
        setPullStatus(errLine)
        flash(`${modeTag} · ${errLine}`)
      } else if (freshCount === 0) {
        const hint =
          meta.emptyHints[0] ??
          (meta.mode === 'live'
            ? 'No new items — inbox already has matches, or sources were empty.'
            : 'No new items this pull.')
        setPullStatus(hint)
        flash(`${modeTag} · 0 new`)
      } else if (autoScheduled > 0) {
        setPullStatus(
          `Added ${freshCount} · auto-scheduled ${autoScheduled} high-confidence.`,
        )
        flash(
          `${modeTag} · ${freshCount} new · auto-added ${autoScheduled} · pet XP up`,
        )
      } else {
        setPullStatus(
          `${freshCount} new candidate${freshCount === 1 ? '' : 's'} ready.`,
        )
        flash(`${modeTag} · ${freshCount} new · pet XP up`)
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
    setState((s) => ({
      ...s,
      stacks: s.stacks.map((st) => (st.id === stack.id ? stack : st)),
    }))
  }, [])

  const setEventStack = useCallback((eventId: string, stackId: string) => {
    setState((s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === eventId
          ? { ...e, reminderStackId: stackId, reminderOverride: undefined }
          : e,
      ),
    }))
  }, [])

  const setEventOverride = useCallback(
    (eventId: string, offsets: ReminderOffset[] | undefined) => {
      setState((s) => ({
        ...s,
        events: s.events.map((e) =>
          e.id === eventId ? { ...e, reminderOverride: offsets } : e,
        ),
      }))
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
    const next = resetState()
    setState(next)
    setPullStatus(null)
    flash('Demo data restored')
  }, [flash])

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
    dismissHero,
    scheduleCandidate,
    dismissCandidate,
    pullSources,
    setDefaultStack,
    updateStack,
    setEventStack,
    setEventOverride,
    toggleAutoAdd,
    petReact,
    hardReset,
  }
}
