import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Hero } from './components/Hero'
import { CompanionPet } from './components/CompanionPet'
import { MixHome } from './components/MixHome'
import { SourceInbox } from './components/SourceInbox'
import { ReminderStackEditor } from './components/ReminderStackEditor'
import { GoogleConnect } from './components/GoogleConnect'
import { BlinkHeaderPet } from './components/BlinkHeaderPet'
import { AppMenu } from './components/AppMenu'
import { UpcomingList } from './components/UpcomingList'
import { PullDecisionSheet } from './components/PullDecisionSheet'
import { LeaveNowMoment } from './components/LeaveNowMoment'
import { useAppState } from './hooks/useAppState'

export default function App() {
  const {
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
    toggleAutoAdd,
    petReact,
    hardReset,
    notifyCaptureImported,
  } = useAppState()

  const [menuOpen, setMenuOpen] = useState(false)
  const [uiFocusEventId, setUiFocusEventId] = useState<string | null>(null)
  const [pullSheetOpen, setPullSheetOpen] = useState(false)
  const [leaveMomentOpen, setLeaveMomentOpen] = useState(false)
  const activeFocusId = uiFocusEventId ?? focusEventId

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const openPullSheet = useCallback(() => {
    setMenuOpen(false)
    setPullSheetOpen(true)
  }, [])

  const inboxCount = pendingCandidates.length
  const eventCount = upcomingEvents.length
  const leadCandidate = pendingCandidates[0] ?? null

  const leaveEvent = useMemo(() => {
    if (!activeFocusId) return null
    return upcomingEvents.find((e) => e.id === activeFocusId) ?? null
  }, [activeFocusId, upcomingEvents])

  // Cap notification tap → leave-now glass moment
  useEffect(() => {
    if (toast === 'Opened from reminder' && leaveEvent) {
      setLeaveMomentOpen(true)
    }
  }, [toast, leaveEvent])

  const handleTopPull = useCallback(async () => {
    setPullSheetOpen(true)
    await pullSources()
  }, [pullSources])

  const menuSections = useMemo(
    () => [
      {
        id: 'inbox' as const,
        title: 'Source inbox',
        hint: 'Appointments waiting to land on your calendar',
        accent: 'coral' as const,
        badge:
          inboxCount > 0 ? (
            <span className="section-badge section-badge-hot">{inboxCount}</span>
          ) : (
            <span className="section-badge">clear</span>
          ),
        children: (
          <SourceInbox
            candidates={pendingCandidates}
            pulling={pulling}
            autoAdd={state.autoAddHighConfidence}
            pullStatus={pullStatus}
            onPull={pullSources}
            onSchedule={scheduleCandidate}
            onDismiss={dismissCandidate}
            onToggleAutoAdd={toggleAutoAdd}
            onCaptureImported={({ added }) => notifyCaptureImported(added)}
            onOpenPullSheet={openPullSheet}
          />
        ),
      },
      {
        id: 'upcoming' as const,
        title: 'Upcoming list',
        hint: 'Vivid labels · ADHD-friendly hierarchy',
        accent: 'cyan' as const,
        badge: (
          <span className="section-badge">
            {eventCount} event{eventCount === 1 ? '' : 's'}
          </span>
        ),
        children: (
          <UpcomingList
            events={upcomingEvents}
            stacks={state.stacks}
            onChangeStack={setEventStack}
            onOpenEvent={(id) => {
              setUiFocusEventId(id)
              setMenuOpen(false)
            }}
          />
        ),
      },
      {
        id: 'google' as const,
        title: 'Google connect',
        hint: 'Calendar + Gmail live pull',
        accent: 'sky' as const,
        children: <GoogleConnect />,
      },
      {
        id: 'reminders' as const,
        title: 'Reminder stacks',
        hint: 'Defaults for new events · override per event',
        accent: 'lime' as const,
        children: (
          <ReminderStackEditor
            stacks={state.stacks}
            defaultStackId={state.defaultStackId}
            onSetDefault={setDefaultStack}
            onUpdateStack={updateStack}
          />
        ),
      },
      {
        id: 'blink' as const,
        title: 'Blink',
        hint: 'Companion grows from pulls + schedules',
        accent: 'amber' as const,
        children: <CompanionPet pet={state.pet} onReact={petReact} />,
      },
    ],
    [
      inboxCount,
      eventCount,
      pendingCandidates,
      pulling,
      state.autoAddHighConfidence,
      state.stacks,
      state.defaultStackId,
      state.pet,
      pullStatus,
      pullSources,
      scheduleCandidate,
      dismissCandidate,
      toggleAutoAdd,
      notifyCaptureImported,
      upcomingEvents,
      setEventStack,
      setDefaultStack,
      updateStack,
      petReact,
      openPullSheet,
    ],
  )

  if (!state.hasSeenHero) {
    return <Hero onEnter={dismissHero} />
  }

  return (
    <div className="app-shell app-shell--calendar-first app-shell--mix">
      <div className="mix-aurora" aria-hidden>
        <span className="mix-aurora-orb mix-aurora-orb--cyan" />
        <span className="mix-aurora-orb mix-aurora-orb--coral" />
        <span className="mix-aurora-orb mix-aurora-orb--lime" />
      </div>

      <header className="topbar topbar--calendar topbar--mix">
        <div className="topbar-brand-row">
          <BlinkHeaderPet pet={state.pet} onReact={petReact} />
          <div>
            <div className="brand-mark">LUMINA</div>
            <div className="brand-sub">
              <span className="brand-sub-full">ADHD Calendar Companion</span>
              <span className="brand-sub-short">Companion</span>
            </div>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm topbar-pull"
            onClick={() => void handleTopPull()}
            disabled={pulling}
          >
            {pulling ? 'Scanning…' : 'Pull'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm menu-trigger"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={openMenu}
          >
            <span className="menu-trigger-icon" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Menu
            {inboxCount > 0 && (
              <span className="menu-trigger-badge">{inboxCount}</span>
            )}
          </button>
        </div>
      </header>

      <main className="layout layout-calendar layout-mix">
        <MixHome
          events={upcomingEvents}
          stacks={state.stacks}
          pet={state.pet}
          onChangeStack={setEventStack}
          focusEventId={activeFocusId}
          onFocusConsumed={() => {
            setUiFocusEventId(null)
            clearFocusEvent()
          }}
        />
      </main>

      <AppMenu
        open={menuOpen}
        onClose={closeMenu}
        sections={menuSections}
        footer={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              hardReset()
              closeMenu()
            }}
          >
            Reset calendar
          </button>
        }
      />

      <PullDecisionSheet
        open={pullSheetOpen}
        candidate={leadCandidate}
        remaining={inboxCount}
        pulling={pulling}
        pullStatus={pullStatus}
        onAdd={(id) => {
          scheduleCandidate(id)
        }}
        onSkip={(id) => {
          dismissCandidate(id)
        }}
        onClose={() => setPullSheetOpen(false)}
      />

      <LeaveNowMoment
        open={leaveMomentOpen}
        event={leaveEvent}
        stacks={state.stacks}
        onOpenEvent={() => {
          if (leaveEvent) setUiFocusEventId(leaveEvent.id)
          setLeaveMomentOpen(false)
        }}
        onDismiss={() => setLeaveMomentOpen(false)}
      />

      <AnimatePresence>
        {toast && toast !== 'Opened from reminder' && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
