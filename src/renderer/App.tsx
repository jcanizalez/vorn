import { useEffect, useState, Suspense, lazy } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores'
import { GridView } from './components/GridView'
import { TabView } from './components/TabView'
import { MobileSinglePane } from './components/MobileSinglePane'
import { FocusedTerminal } from './components/FocusedTerminal'
import { ProjectSidebar } from './components/project-sidebar/ProjectSidebar'
import { PromptLauncher } from './components/PromptLauncher'
import { AddProjectDialog } from './components/AddProjectDialog'
const WorkflowEditor = lazy(() =>
  import('./components/workflow-editor/WorkflowEditor').then((m) => ({ default: m.WorkflowEditor }))
)
import { executeWorkflow as runWorkflow } from './lib/workflow-execution'
import { CommandPalette } from './components/CommandPalette'
import { SessionRestoredBanner } from './components/SessionRestoredBanner'
import { GridToolbar } from './components/GridToolbar'
import { SettingsPage } from './components/SettingsPage'
import { RecentSessionsPopover } from './components/RecentSessionsPopover'
import { Tooltip } from './components/Tooltip'
import { RotateCcw, Monitor, ListTodo, Plus, Menu } from 'lucide-react'
import { MobileBottomTabs } from './components/MobileBottomTabs'
import { TaskToolbar } from './components/TaskToolbar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useVirtualKeyboard } from './hooks/useVirtualKeyboard'
import { useGitDiffPolling } from './hooks/useGitDiffPolling'
import { consumePendingTerminalClose } from './lib/terminal-close'
import {
  setDefaultFontSize,
  initGlobalDataListener,
  disposeGlobalDataListener
} from './lib/terminal-registry'
import { WorktreeCleanupDialog } from './components/WorktreeCleanupDialog'
import { RightPanel } from './components/RightPanel'
import { TaskBoardView } from './components/TaskBoardView'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel'
import { MissedScheduleDialog } from './components/MissedScheduleDialog'
import { OnboardingModal } from './components/OnboardingModal'
import { TerminalPanel } from './components/TerminalPanel'
import { UpdateBanner } from './components/UpdateBanner'
import { ToastContainer } from './components/Toast'
import { AddTaskDialog } from './components/AddTaskDialog'
import { isWeb } from './lib/platform'
import { useIsMobile } from './hooks/useIsMobile'
import { resolveResumeSessionId, buildRestorePayload } from './lib/session-utils'
const isMac = navigator.platform.toUpperCase().includes('MAC')

function WindowControls() {
  if (isMac || isWeb) return null
  return (
    <div className="flex items-center titlebar-no-drag ml-2">
      <button
        onClick={() => window.api.windowMinimize()}
        className="w-[46px] h-[32px] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
        title="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" className="text-gray-400">
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        onClick={() => window.api.windowMaximize()}
        className="w-[46px] h-[32px] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
        title="Maximize"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-gray-400"
        >
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        onClick={() => window.api.windowClose()}
        className="w-[46px] h-[32px] flex items-center justify-center hover:bg-red-500/80 transition-colors group"
        title="Close"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-gray-400 group-hover:text-white"
        >
          <path d="M1 1l8 8M9 1l-8 8" />
        </svg>
      </button>
    </div>
  )
}

export function App() {
  const {
    focusedId,
    showBanner,
    isSidebarOpen,
    isSettingsOpen,
    isShortcutsPanelOpen,
    isOnboardingOpen,
    isTerminalPanelOpen,
    isWorkflowEditorOpen,
    layoutMode,
    mainViewMode,
    selectedTaskId,
    diffSidebarTerminalId
  } = useAppStore(
    useShallow((s) => ({
      focusedId: s.focusedTerminalId,
      showBanner: s.showSessionBanner,
      isSidebarOpen: s.isSidebarOpen,
      isSettingsOpen: s.isSettingsOpen,
      isShortcutsPanelOpen: s.isShortcutsPanelOpen,
      isOnboardingOpen: s.isOnboardingOpen,
      isTerminalPanelOpen: s.isTerminalPanelOpen,
      isWorkflowEditorOpen: s.isWorkflowEditorOpen,
      layoutMode: s.config?.defaults?.layoutMode ?? 'grid',
      mainViewMode: s.config?.defaults?.mainViewMode ?? 'sessions',
      selectedTaskId: s.selectedTaskId,
      diffSidebarTerminalId: s.diffSidebarTerminalId
    }))
  )
  const setDialogOpen = useAppStore((s) => s.setNewAgentDialogOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleTerminalPanel = useAppStore((s) => s.toggleTerminalPanel)
  const setMainViewMode = useAppStore((s) => s.setMainViewMode)
  const [recentOpen, setRecentOpen] = useState(false)
  const isMobile = useIsMobile()

  // On mobile, auto-close sidebar on initial load
  useEffect(() => {
    if (isMobile && isSidebarOpen) {
      toggleSidebar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  useKeyboardShortcuts()
  const { keyboardHeight } = useVirtualKeyboard()
  useGitDiffPolling()

  // Load config and previous sessions on mount
  useEffect(() => {
    initGlobalDataListener()
    ;(async () => {
      try {
        const [config, prev] = await Promise.all([
          window.api.loadConfig(),
          window.api.getPreviousSessions()
        ])
        useAppStore.getState().setConfig(config)
        if (config.defaults.fontSize) {
          setDefaultFontSize(config.defaults.fontSize)
        }

        // Request notification permission if enabled
        if (config.defaults.notifications?.enabled && Notification.permission === 'default') {
          Notification.requestPermission()
        }

        if (!config.defaults.hasSeenOnboarding) {
          useAppStore.getState().setOnboardingOpen(true)
        }
        // Web: hydrate already-running sessions that started before we connected
        if (isWeb && 'listActiveSessions' in window.api) {
          try {
            const active = (await (
              window.api as { listActiveSessions: () => Promise<unknown[]> }
            ).listActiveSessions()) as import('../shared/types').TerminalSession[]
            const state = useAppStore.getState()
            for (const session of active) {
              if (!state.terminals.has(session.id)) {
                state.addTerminal(session)
              }
            }
          } catch (err) {
            console.error('[App] failed to hydrate active sessions:', err)
          }
        }

        if (prev && prev.length > 0) {
          if (config.defaults.reopenSessions) {
            // Auto-restore sessions — prefer hook-correlated session ID (exact),
            // fall back to scanning agent history when hooks weren't active.
            const claimed = new Set<string>()
            for (const s of prev) {
              const resumeSessionId = await resolveResumeSessionId(s, claimed)
              if (resumeSessionId) claimed.add(resumeSessionId)
              const session = await window.api.createTerminal(
                buildRestorePayload(s, resumeSessionId)
              )
              useAppStore.getState().addTerminal(session)
            }
            window.api.clearPreviousSessions()
          } else {
            useAppStore.getState().setSessionBanner(true, prev)
          }
        }
      } catch (err) {
        console.error('[App] startup initialization failed:', err)
      }
    })()

    const removeExitListener = window.api.onTerminalExit(({ id }) => {
      const state = useAppStore.getState()
      if (consumePendingTerminalClose(id)) {
        if (state.terminals.has(id)) {
          state.removeTerminal(id)
        }
        const assignedTask = (state.config?.tasks || []).find(
          (t) => t.assignedSessionId === id && t.status === 'in_progress'
        )
        if (assignedTask) {
          state.reviewTask(assignedTask.id)
        }
        return
      }

      // If it's a shell tab, remove it; otherwise update agent status
      if (state.shellTabs.some((t) => t.id === id)) {
        state.removeShellTab(id)
      } else {
        const terminal = state.terminals.get(id)
        if (!terminal) return

        state.updateStatus(id, 'idle')

        // Move assigned task to review when agent exits
        const assignedTask = (state.config?.tasks || []).find(
          (t) => t.assignedSessionId === id && t.status === 'in_progress'
        )
        if (assignedTask) {
          state.reviewTask(assignedTask.id)
        }
      }
    })

    const removeSessionCreatedListener = window.api.onSessionCreated((session) => {
      const state = useAppStore.getState()
      if (!state.terminals.has(session.id)) {
        state.addTerminal(session)
      }
    })

    const removeConfigListener = window.api.onConfigChanged((config) => {
      useAppStore.getState().setConfig(config)
    })

    const removeMenuListener = window.api.onMenuNewAgent(() => {
      useAppStore.getState().setNewAgentDialogOpen(true)
    })

    const removeWidgetSelectListener = window.api.onWidgetSelectTerminal((terminalId) => {
      useAppStore.getState().setFocusedTerminal(terminalId)
    })

    // Scheduler: auto-execute workflows when triggered
    const removeSchedulerListener = window.api.onSchedulerExecute(async ({ workflowId }) => {
      const state = useAppStore.getState()
      const workflow = state.config?.workflows?.find((w) => w.id === workflowId)
      if (!workflow) return

      await runWorkflow(workflow, undefined, { source: 'scheduler' })
    })

    const removeUpdateListener = window.api.onUpdateDownloaded(({ version }) => {
      useAppStore.getState().setUpdateVersion(version)
    })

    const removeSessionUpdatedListener = window.api.onSessionUpdated((session) => {
      const store = useAppStore.getState()
      const existing = store.terminals.get(session.id)
      if (existing) {
        if (session.branch && existing.session.branch !== session.branch) {
          store.updateSessionBranch(session.id, session.branch)
        }
        if (session.displayName && existing.session.displayName !== session.displayName) {
          store.renameTerminal(session.id, session.displayName)
        }
      } else if (session.branch) {
        store.updateHeadlessSession(session.id, { branch: session.branch })
      }
    })

    // Headless agent tracking
    const removeHeadlessExitListener = window.api.onHeadlessExit(({ id, exitCode }) => {
      useAppStore.getState().updateHeadlessSession(id, {
        status: 'exited',
        exitCode,
        endedAt: Date.now()
      })
    })

    const removeHeadlessDataListener = window.api.onHeadlessData(({ id, data }) => {
      const lines = data.split('\n').filter((l) => l.trim())
      if (lines.length > 0) {
        useAppStore.getState().setHeadlessLastOutput(id, lines[lines.length - 1])
      }
    })

    // Poll headless sessions every 5s for sync
    const pollHeadless = async (): Promise<void> => {
      try {
        const sessions = await window.api.listHeadlessSessions()
        useAppStore.getState().setHeadlessSessions(sessions)
      } catch {
        // ignore — server may not be ready yet
      }
    }
    pollHeadless()
    const headlessPollInterval = setInterval(pollHeadless, 5000)

    // Auto-prune exited headless sessions
    const pruneInterval = setInterval(() => {
      const retentionMinutes =
        useAppStore.getState().config?.defaults?.headlessRetentionMinutes ?? 5
      useAppStore.getState().pruneExitedHeadless(retentionMinutes * 60_000)
    }, 30_000)

    return () => {
      disposeGlobalDataListener()
      removeExitListener()
      removeSessionCreatedListener()
      removeConfigListener()
      removeMenuListener()
      removeSchedulerListener()
      removeWidgetSelectListener()
      removeUpdateListener()
      removeSessionUpdatedListener()
      removeHeadlessExitListener()
      removeHeadlessDataListener()
      clearInterval(headlessPollInterval)
      clearInterval(pruneInterval)
    }
  }, [])

  return (
    <div
      className="flex h-dvh text-gray-100"
      style={{
        background: '#1a1a1e',
        paddingTop: 'var(--safe-top)',
        paddingLeft: 'var(--safe-left)',
        paddingRight: 'var(--safe-right)',
        paddingBottom: 'calc(var(--safe-bottom) + var(--keyboard-height, 0px))'
      }}
    >
      <ProjectSidebar />

      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={
          isMobile && keyboardHeight === 0
            ? { paddingBottom: 'calc(64px + var(--safe-bottom, 0px))' }
            : undefined
        }
      >
        {/* Top bar */}
        <div
          className={`titlebar-drag shrink-0 border-b border-white/[0.06]
                        flex items-center justify-between ${isMobile ? 'px-2' : 'px-3'} h-[52px]`}
          style={!isSidebarOpen && !isWeb && !isMobile ? { paddingLeft: '80px' } : undefined}
        >
          <div className={`flex items-center titlebar-no-drag ${isMobile ? 'gap-2.5' : 'gap-1'}`}>
            {/* Mobile: always show hamburger. Desktop: show sidebar toggle only when closed */}
            {(isMobile || !isSidebarOpen) &&
              (isMobile ? (
                <button
                  onClick={toggleSidebar}
                  className="text-gray-400 hover:text-white active:text-white p-2 transition-colors rounded-full"
                  style={{
                    background: 'var(--glass-bg, transparent)',
                    backdropFilter: 'var(--glass-blur, none)',
                    WebkitBackdropFilter: 'var(--glass-blur, none)',
                    boxShadow: 'var(--glass-shadow, none)'
                  }}
                  title="Show sidebar"
                >
                  <Menu size={20} strokeWidth={2} />
                </button>
              ) : (
                <Tooltip
                  label="Toggle sidebar"
                  shortcut={`${isMac ? '⌘' : 'Ctrl+'}B`}
                  position="bottom"
                >
                  <button
                    onClick={toggleSidebar}
                    className="text-gray-400 hover:text-white active:text-white p-1 transition-colors rounded-md"
                    title="Show sidebar"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 3v18" />
                    </svg>
                  </button>
                </Tooltip>
              ))}
            {/* Main view toggle: Sessions / Tasks (hidden on mobile — bottom tabs handle it) */}
            {!isMobile && (
              <>
                {(isMobile || !isSidebarOpen) && (
                  <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
                )}
                <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                  <Tooltip
                    label="Sessions"
                    shortcut={`${isMac ? '⌘' : 'Ctrl+'}S`}
                    position="bottom"
                  >
                    <button
                      onClick={() => setMainViewMode('sessions')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        mainViewMode === 'sessions'
                          ? 'bg-white/[0.1] text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <Monitor size={14} strokeWidth={2} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Tasks" shortcut={`${isMac ? '⌘' : 'Ctrl+'}T`} position="bottom">
                    <button
                      onClick={() => setMainViewMode('tasks')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        mainViewMode === 'tasks'
                          ? 'bg-white/[0.1] text-white'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <ListTodo size={14} strokeWidth={2} />
                    </button>
                  </Tooltip>
                </div>
              </>
            )}
          </div>
          <div className={`flex items-center titlebar-no-drag ${isMobile ? 'gap-1.5' : 'gap-1'}`}>
            {mainViewMode === 'sessions' ? (
              <>
                {!isMobile && <GridToolbar />}
                {!isMobile && (
                  <>
                    <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
                    <Tooltip label="Terminal panel" shortcut="Ctrl+`" position="bottom">
                      <button
                        onClick={toggleTerminalPanel}
                        className={`p-1 rounded-md transition-colors ${
                          isTerminalPanelOpen
                            ? 'text-white bg-white/[0.1]'
                            : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="4 17 10 11 4 5" />
                          <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                      </button>
                    </Tooltip>
                    <div className="relative flex items-center">
                      <Tooltip label="Recent sessions" position="bottom">
                        <button
                          onClick={() => setRecentOpen(!recentOpen)}
                          className="p-1 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
                        >
                          <RotateCcw size={16} strokeWidth={1.5} />
                        </button>
                      </Tooltip>
                      <RecentSessionsPopover
                        isOpen={recentOpen}
                        onClose={() => setRecentOpen(false)}
                      />
                    </div>
                  </>
                )}
                {isMobile ? (
                  <button
                    onClick={() => setDialogOpen(true)}
                    className="p-2.5 text-xs rounded-full font-medium text-gray-200 hover:text-white active:bg-white/[0.15] transition-colors"
                    style={{
                      background: 'var(--glass-bg, rgba(255,255,255,0.06))',
                      backdropFilter: 'var(--glass-blur, none)',
                      WebkitBackdropFilter: 'var(--glass-blur, none)',
                      boxShadow: 'var(--glass-shadow, none)'
                    }}
                  >
                    <Plus size={18} strokeWidth={2} />
                  </button>
                ) : (
                  <Tooltip
                    label="New session"
                    shortcut={`${isMac ? '⌘' : 'Ctrl+'}N`}
                    position="bottom"
                  >
                    <button
                      onClick={() => setDialogOpen(true)}
                      className="p-1 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
                    >
                      <Plus size={16} strokeWidth={2} />
                    </button>
                  </Tooltip>
                )}
              </>
            ) : (
              <>
                {!isMobile && <TaskToolbar />}
                {!isMobile && (
                  <>
                    <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
                    <Tooltip label="Terminal panel" shortcut="Ctrl+`" position="bottom">
                      <button
                        onClick={toggleTerminalPanel}
                        className={`p-1 rounded-md transition-colors ${
                          isTerminalPanelOpen
                            ? 'text-white bg-white/[0.1]'
                            : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="4 17 10 11 4 5" />
                          <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                      </button>
                    </Tooltip>
                  </>
                )}
                {isMobile ? (
                  <button
                    onClick={() => useAppStore.getState().setTaskDialogOpen(true)}
                    className="p-2.5 text-xs rounded-full font-medium text-gray-200 hover:text-white active:bg-white/[0.15] transition-colors"
                    style={{
                      background: 'var(--glass-bg, rgba(255,255,255,0.06))',
                      backdropFilter: 'var(--glass-blur, none)',
                      WebkitBackdropFilter: 'var(--glass-blur, none)',
                      boxShadow: 'var(--glass-shadow, none)'
                    }}
                  >
                    <Plus size={18} strokeWidth={2} />
                  </button>
                ) : (
                  <Tooltip label="Add task" position="bottom">
                    <button
                      onClick={() => useAppStore.getState().setTaskDialogOpen(true)}
                      className="p-1 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
                    >
                      <Plus size={16} strokeWidth={2} />
                    </button>
                  </Tooltip>
                )}
              </>
            )}
            <WindowControls />
          </div>
        </div>

        {showBanner && <SessionRestoredBanner />}
        <UpdateBanner />
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {mainViewMode === 'tasks' ? (
              <TaskBoardView />
            ) : isMobile ? (
              <MobileSinglePane />
            ) : layoutMode === 'tabs' ? (
              <TabView />
            ) : (
              <GridView />
            )}
          </div>
          {mainViewMode === 'tasks' && selectedTaskId && <TaskDetailPanel />}
          {mainViewMode === 'sessions' && diffSidebarTerminalId && <RightPanel />}
        </div>
        <TerminalPanel />
        {isMobile && <MobileBottomTabs hidden={keyboardHeight > 0} />}
      </main>

      {/* Focus overlay — no AnimatePresence so terminal handoff is instant */}
      {focusedId && <FocusedTerminal />}

      <PromptLauncher mode="overlay" onClose={() => setDialogOpen(false)} />
      <AddProjectDialog />
      {isWorkflowEditorOpen && (
        <Suspense fallback={null}>
          <WorkflowEditor />
        </Suspense>
      )}
      <CommandPalette />
      <AddTaskDialog />
      <WorktreeCleanupDialog />
      <MissedScheduleDialog />
      <AnimatePresence>{isShortcutsPanelOpen && <KeyboardShortcutsPanel />}</AnimatePresence>

      <AnimatePresence>{isSettingsOpen && <SettingsPage />}</AnimatePresence>

      <AnimatePresence>{isOnboardingOpen && <OnboardingModal />}</AnimatePresence>

      <ToastContainer />
    </div>
  )
}
