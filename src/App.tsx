import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Hero } from './components/Hero'
import { CompanionPet } from './components/CompanionPet'
import { MixHome } from './components/MixHome'
import { SourceInbox } from './components/SourceInbox'
import { AutoRemindersPanel } from './components/AutoRemindersPanel'
import { GoogleConnect } from './components/GoogleConnect'
import { BlinkHeaderPet } from './components/BlinkHeaderPet'
import { AppMenu } from './components/AppMenu'
import { DailyTodoList } from './components/DailyTodoList'
import { TaskGroupsPanel } from './components/TaskGroupsPanel'
import { AgendaView } from './components/AgendaView'
import { PullDecisionSheet } from './components/PullDecisionSheet'
import { LeaveNowMoment } from './components/LeaveNowMoment'
import { UpdateAvailableSheet } from './components/UpdateAvailableSheet'
import { useAppState } from './hooks/useAppState'
import { dayKey } from './lib/dailyTodos'
import { isAndroidNative } from './lib/platform'
import {
  checkForAppUpdate,
  dismissUpdateTag,
  downloadAndInstallUpdate,
  markUpdateChecked,
  openReleaseInBrowser,
  retryInstallFromPath,
  shouldAutoCheckUpdates,
  wasUpdateDismissed,
  type DownloadInstallResult,
  type InstalledVersion,
  type LatestUpdateInfo,
} from './lib/appUpdate'

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
    setEventCategory,
    addManualEntry,
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
  } = useAppState()

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuFocusSection, setMenuFocusSection] = useState<
    'todos' | 'groups' | 'agenda' | null
  >(null)
  const [uiFocusEventId, setUiFocusEventId] = useState<string | null>(null)
  const [pullSheetOpen, setPullSheetOpen] = useState(false)
  const [leaveMomentOpen, setLeaveMomentOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updatePhase, setUpdatePhase] = useState<
    'idle' | 'checking' | 'ready' | 'downloading' | 'permission' | 'done' | 'error'
  >('idle')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateInstalled, setUpdateInstalled] = useState<InstalledVersion | null>(
    null,
  )
  const [updateLatest, setUpdateLatest] = useState<LatestUpdateInfo | null>(null)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [updateResult, setUpdateResult] = useState<DownloadInstallResult | null>(
    null,
  )
  const activeFocusId = uiFocusEventId ?? focusEventId

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setMenuFocusSection(null)
  }, [])
  const openMenu = useCallback(() => setMenuOpen(true), [])
  const openPullSheet = useCallback(() => {
    setMenuOpen(false)
    setPullSheetOpen(true)
  }, [])
  const openAgendaMenu = useCallback(() => {
    setMenuFocusSection('agenda')
    setMenuOpen(true)
  }, [])

  const runUpdateCheck = useCallback(async (opts?: { forceSheet?: boolean }) => {
    if (!isAndroidNative()) return
    setUpdatePhase('checking')
    setUpdateMessage(null)
    setUpdateResult(null)
    if (opts?.forceSheet) setUpdateOpen(true)
    try {
      const result = await checkForAppUpdate()
      markUpdateChecked()
      setUpdateInstalled(result.installed)
      setUpdateLatest(result.latest)
      if (result.available && result.latest?.tag) {
        if (!wasUpdateDismissed(result.latest.tag) || opts?.forceSheet) {
          setUpdatePhase('ready')
          setUpdateMessage(
            `New build ${result.latest.versionName || result.latest.tag} is ready.`,
          )
          setUpdateOpen(true)
        } else {
          setUpdatePhase('idle')
        }
      } else if (opts?.forceSheet) {
        setUpdatePhase(result.error ? 'error' : 'ready')
        setUpdateMessage(
          result.hint ||
            result.error ||
            'You’re on the latest published APK.',
        )
        setUpdateOpen(true)
      } else {
        setUpdatePhase('idle')
      }
    } catch (err) {
      if (opts?.forceSheet) {
        setUpdatePhase('error')
        setUpdateMessage(
          err instanceof Error ? err.message : 'Update check failed.',
        )
        setUpdateOpen(true)
      }
    }
  }, [])

  useEffect(() => {
    if (!isAndroidNative()) return
    if (!shouldAutoCheckUpdates()) return
    const timer = window.setTimeout(() => {
      void runUpdateCheck()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [runUpdateCheck])

  const handleUpdateDownload = useCallback(async () => {
    if (!updateLatest?.ok) return
    setUpdatePhase('downloading')
    setUpdateProgress(0)
    setUpdateMessage('Downloading APK…')
    const result = await downloadAndInstallUpdate(updateLatest, (pct) => {
      setUpdateProgress(pct)
    })
    setUpdateResult(result)
    if (result.ok) {
      setUpdatePhase('done')
      setUpdateMessage('System installer opened — confirm Install.')
      return
    }
    if (result.needsSettings || result.error === 'install_permission_required') {
      setUpdatePhase('permission')
      setUpdateMessage(
        result.hint ||
          'Allow LUMINA to install unknown apps, then tap Install again.',
      )
      return
    }
    setUpdatePhase('error')
    setUpdateMessage(
      result.hint || result.error || 'Download failed. Try GitHub release.',
    )
  }, [updateLatest])

  const handleRetryInstall = useCallback(async () => {
    if (!updateResult?.path) {
      await handleUpdateDownload()
      return
    }
    const result = await retryInstallFromPath(updateResult.path)
    setUpdateResult(result)
    if (result.ok) {
      setUpdatePhase('done')
      setUpdateMessage('System installer opened — confirm Install.')
      return
    }
    if (result.needsSettings) {
      setUpdatePhase('permission')
      setUpdateMessage(result.hint || 'Allow unknown apps, then retry.')
      return
    }
    setUpdatePhase('error')
    setUpdateMessage(result.hint || result.error || 'Install failed.')
  }, [updateResult, handleUpdateDownload])

  const openUpdateFromMenu = useCallback(() => {
    closeMenu()
    void runUpdateCheck({ forceSheet: true })
  }, [closeMenu, runUpdateCheck])

  const inboxCount = pendingCandidates.length
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

  const todayTodoCount = useMemo(() => {
    const key = dayKey()
    return (state.dailyTodos ?? []).filter((t) => t.date === key && !t.done)
      .length
  }, [state.dailyTodos])

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
        id: 'todos' as const,
        title: 'Daily todos',
        hint: 'Today’s list · repeatable tasks',
        accent: 'cyan' as const,
        badge:
          todayTodoCount > 0 ? (
            <span className="section-badge">{todayTodoCount} open</span>
          ) : undefined,
        children: (
          <DailyTodoList
            todos={state.dailyTodos ?? []}
            onEnsureDay={ensureDayTodos}
            onAdd={addDailyTodo}
            onToggle={toggleDailyTodo}
            onRemove={removeDailyTodo}
            onSetRepeat={setTodoRepeat}
          />
        ),
      },
      {
        id: 'groups' as const,
        title: 'Task groups',
        hint: 'Health, hygiene, fitness + more → daily or calendar',
        accent: 'sky' as const,
        children: (
          <TaskGroupsPanel
            groups={state.taskGroups ?? []}
            onPullToDaily={pullGroupItemToDaily}
            onPullToCalendar={pullGroupItemToCalendar}
          />
        ),
      },
      {
        id: 'agenda' as const,
        title: 'Agenda & review',
        hint: 'Day agenda + monthly task check-in',
        accent: 'lime' as const,
        children: (
          <AgendaView
            todos={state.dailyTodos ?? []}
            events={state.events}
            onEnsureDay={ensureDayTodos}
            onAdd={addDailyTodo}
            onToggle={toggleDailyTodo}
            onRemove={removeDailyTodo}
            onSetRepeat={setTodoRepeat}
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
        title: 'Auto reminders',
        hint: 'Friendly defaults · leave-now included',
        accent: 'lime' as const,
        children: (
          <AutoRemindersPanel
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
      todayTodoCount,
      pendingCandidates,
      pulling,
      state.autoAddHighConfidence,
      state.stacks,
      state.defaultStackId,
      state.pet,
      state.dailyTodos,
      state.taskGroups,
      state.events,
      pullStatus,
      pullSources,
      scheduleCandidate,
      dismissCandidate,
      toggleAutoAdd,
      notifyCaptureImported,
      setDefaultStack,
      updateStack,
      petReact,
      openPullSheet,
      ensureDayTodos,
      addDailyTodo,
      toggleDailyTodo,
      removeDailyTodo,
      setTodoRepeat,
      pullGroupItemToDaily,
      pullGroupItemToCalendar,
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

      {!menuOpen && (
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
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openMenu()
              }}
            >
              <span className="menu-trigger-icon" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              {inboxCount > 0 && (
                <span className="menu-trigger-badge">{inboxCount}</span>
              )}
            </button>
          </div>
        </header>
      )}

      <main className="layout layout-calendar layout-mix">
        <MixHome
          events={upcomingEvents}
          stacks={state.stacks}
          pet={state.pet}
          dailyTodos={state.dailyTodos ?? []}
          onChangeStack={setEventStack}
          onChangeCategory={setEventCategory}
          onAddEntry={addManualEntry}
          focusEventId={activeFocusId}
          onFocusConsumed={() => {
            setUiFocusEventId(null)
            clearFocusEvent()
          }}
          onOpenEvent={(id) => setUiFocusEventId(id)}
          onEnsureDayTodos={ensureDayTodos}
          onAddDailyTodo={addDailyTodo}
          onToggleDailyTodo={toggleDailyTodo}
          onRemoveDailyTodo={removeDailyTodo}
          onSetTodoRepeat={setTodoRepeat}
          onOpenAgenda={openAgendaMenu}
        />
      </main>

      <AppMenu
        open={menuOpen}
        onClose={closeMenu}
        sections={menuSections}
        initialSection={menuFocusSection}
        footer={
          <>
            {isAndroidNative() && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={openUpdateFromMenu}
              >
                Check for updates
              </button>
            )}
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
          </>
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

      <UpdateAvailableSheet
        open={updateOpen}
        phase={updatePhase === 'idle' ? 'ready' : updatePhase}
        progress={updateProgress}
        installed={updateInstalled}
        latest={updateLatest}
        message={updateMessage}
        lastResult={updateResult}
        onClose={() => {
          if (updateLatest?.tag) dismissUpdateTag(updateLatest.tag)
          setUpdateOpen(false)
        }}
        onDownload={() => void handleUpdateDownload()}
        onOpenRelease={() => {
          if (updateLatest) void openReleaseInBrowser(updateLatest)
        }}
        onRetryInstall={() => void handleRetryInstall()}
        onCheckAgain={() => void runUpdateCheck({ forceSheet: true })}
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
