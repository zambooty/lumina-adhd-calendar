import { AnimatePresence, motion } from 'framer-motion'
import { Hero } from './components/Hero'
import { CompanionPet } from './components/CompanionPet'
import { CalendarView } from './components/CalendarView'
import { SourceInbox } from './components/SourceInbox'
import { ReminderStackEditor } from './components/ReminderStackEditor'
import { useAppState } from './hooks/useAppState'

export default function App() {
  const {
    state,
    pulling,
    toast,
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

  if (!state.hasSeenHero) {
    return <Hero onEnter={dismissHero} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">LUMINA</div>
          <div className="brand-sub">ADHD Calendar Companion</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={hardReset}>
            Reset demo
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={pullSources}
            disabled={pulling}
          >
            {pulling ? 'Scanning…' : 'Pull sources'}
          </button>
        </div>
      </header>

      <main className="layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SourceInbox
            candidates={pendingCandidates}
            pulling={pulling}
            autoAdd={state.autoAddHighConfidence}
            onPull={pullSources}
            onSchedule={scheduleCandidate}
            onDismiss={dismissCandidate}
            onToggleAutoAdd={toggleAutoAdd}
          />
          <CalendarView
            events={upcomingEvents}
            stacks={state.stacks}
            onChangeStack={setEventStack}
          />
        </div>

        <div className="side-stack">
          <CompanionPet pet={state.pet} onReact={petReact} />
          <ReminderStackEditor
            stacks={state.stacks}
            defaultStackId={state.defaultStackId}
            onSetDefault={setDefaultStack}
            onUpdateStack={updateStack}
          />
        </div>
      </main>

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
