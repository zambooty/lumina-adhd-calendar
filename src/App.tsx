import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Hero } from './components/Hero'
import { CompanionPet } from './components/CompanionPet'
import { CalendarView } from './components/CalendarView'
import { SourceInbox } from './components/SourceInbox'
import { ReminderStackEditor } from './components/ReminderStackEditor'
import { GoogleConnect } from './components/GoogleConnect'
import { CollapsiblePanel } from './components/CollapsiblePanel'
import { useAppState } from './hooks/useAppState'

type SectionId = 'inbox' | 'calendar' | 'google' | 'reminders'

const SECTION_STORAGE_KEY = 'lumina.ui.openSections'

const DEFAULT_OPEN: SectionId[] = ['inbox']

function loadOpenSections(): SectionId[] {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY)
    if (!raw) return DEFAULT_OPEN
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_OPEN
    const allowed = new Set<SectionId>(['inbox', 'calendar', 'google', 'reminders'])
    const next = parsed.filter((id): id is SectionId => allowed.has(id as SectionId))
    return next.length > 0 ? next : DEFAULT_OPEN
  } catch {
    return DEFAULT_OPEN
  }
}

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

  const [openSections, setOpenSections] = useState<SectionId[]>(loadOpenSections)

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(openSections))
    } catch {
      /* ignore quota */
    }
  }, [openSections])

  function toggleSection(id: SectionId) {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function isOpen(id: SectionId) {
    return openSections.includes(id)
  }

  if (!state.hasSeenHero) {
    return <Hero onEnter={dismissHero} />
  }

  const inboxCount = pendingCandidates.length
  const eventCount = upcomingEvents.length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">LUMINA</div>
          <div className="brand-sub">ADHD Calendar Companion</div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={hardReset}>
            Reset
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

      <main className="layout layout-stack">
        <CompanionPet pet={state.pet} onReact={petReact} />

        <div className="accordion-stack" role="list">
          <CollapsiblePanel
            id="inbox"
            title="Source inbox"
            hint="Appointments waiting to land on your calendar"
            accent="coral"
            open={isOpen('inbox')}
            onToggle={() => toggleSection('inbox')}
            badge={
              inboxCount > 0 ? (
                <span className="section-badge section-badge-hot">{inboxCount}</span>
              ) : (
                <span className="section-badge">clear</span>
              )
            }
          >
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
          </CollapsiblePanel>

          <CollapsiblePanel
            id="calendar"
            title="Upcoming"
            hint="Vivid labels · ADHD-friendly hierarchy"
            accent="cyan"
            open={isOpen('calendar')}
            onToggle={() => toggleSection('calendar')}
            badge={
              <span className="section-badge">
                {eventCount} event{eventCount === 1 ? '' : 's'}
              </span>
            }
          >
            <CalendarView
              events={upcomingEvents}
              stacks={state.stacks}
              onChangeStack={setEventStack}
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="google"
            title="Google connect"
            hint="Calendar + Gmail live pull"
            accent="sky"
            open={isOpen('google')}
            onToggle={() => toggleSection('google')}
          >
            <GoogleConnect />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="reminders"
            title="Reminder stacks"
            hint="Defaults for new events · override per event"
            accent="lime"
            open={isOpen('reminders')}
            onToggle={() => toggleSection('reminders')}
          >
            <ReminderStackEditor
              stacks={state.stacks}
              defaultStackId={state.defaultStackId}
              onSetDefault={setDefaultStack}
              onUpdateStack={updateStack}
            />
          </CollapsiblePanel>
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
