import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { Hero } from './components/Hero'
import { CompanionPet } from './components/CompanionPet'
import { CalendarView } from './components/CalendarView'
import { SourceInbox } from './components/SourceInbox'
import { ReminderStackEditor } from './components/ReminderStackEditor'
import { GoogleConnect } from './components/GoogleConnect'
import { BlinkHeaderPet } from './components/BlinkHeaderPet'
import { AppMenu } from './components/AppMenu'
import { UpcomingList } from './components/UpcomingList'
import { useAppState } from './hooks/useAppState'

export default function App() {
  const {
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
    toggleAutoAdd,
    petReact,
    hardReset,
  } = useAppState()

  const [menuOpen, setMenuOpen] = useState(false)
  const [focusEventId, setFocusEventId] = useState<string | null>(null)

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const openMenu = useCallback(() => setMenuOpen(true), [])

  const inboxCount = pendingCandidates.length
  const eventCount = upcomingEvents.length

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
              setFocusEventId(id)
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
      upcomingEvents,
      setEventStack,
      setDefaultStack,
      updateStack,
      petReact,
    ],
  )

  if (!state.hasSeenHero) {
    return <Hero onEnter={dismissHero} />
  }

  return (
    <div className="app-shell app-shell--calendar-first">
      <header className="topbar topbar--calendar">
        <div className="topbar-brand-row">
          <BlinkHeaderPet pet={state.pet} onReact={petReact} />
          <div>
            <div className="brand-mark">LUMINA</div>
            <div className="brand-sub">ADHD Calendar Companion</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm topbar-pull"
            onClick={pullSources}
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

      <main className="layout layout-calendar">
        <CalendarView
          events={upcomingEvents}
          stacks={state.stacks}
          onChangeStack={setEventStack}
          focusEventId={focusEventId}
          onFocusConsumed={() => setFocusEventId(null)}
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

      <AnimatePresence>
        {toast && (
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
