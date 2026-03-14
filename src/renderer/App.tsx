import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores'
import { GridView } from './components/GridView'
import { TabView } from './components/TabView'
import { FocusedTerminal } from './components/FocusedTerminal'
import { ProjectSidebar } from './components/ProjectSidebar'
import { PromptLauncher } from './components/PromptLauncher'
import { AddProjectDialog } from './components/AddProjectDialog'
import { WorkflowEditor } from './components/workflow-editor/WorkflowEditor'
import { executeWorkflow as runWorkflow } from './lib/workflow-execution'
import { CommandPalette } from './components/CommandPalette'
import { SessionRestoredBanner } from './components/SessionRestoredBanner'
import { GridToolbar } from './components/GridToolbar'
import { SettingsPage } from './components/SettingsPage'
import { RecentSessionsPopover } from './components/RecentSessionsPopover'
import { RotateCcw, Monitor, ListTodo, Plus } from 'lucide-react'
import { TaskToolbar } from './components/TaskToolbar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useGitDiffPolling } from './hooks/useGitDiffPolling'
import { consumePendingTerminalClose } from './lib/terminal-close'
import { setDefaultFontSize } from './lib/terminal-registry'
import { KbdHint } from './components/KbdHint'
import { WorktreeCleanupDialog } from './components/WorktreeCleanupDialog'
import { DiffSidebar } from './components/DiffSidebar'
import { TaskBoardView } from './components/TaskBoardView'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel'
import { MissedScheduleDialog } from './components/MissedScheduleDialog'
import { OnboardingModal } from './components/OnboardingModal'
import { TerminalPanel } from './components/TerminalPanel'
import { UpdateBanner } from './components/UpdateBanner'
import { ToastContainer } from './components/Toast'
import { AddTaskDialog } from './components/AddTaskDialog'

const isMac = navigator.platform.toUpperCase().includes('MAC')

function WindowControls() {
  if (isMac) return null
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
  const focusedId = useAppStore((s) => s.focusedTerminalId)
  const showBanner = useAppStore((s) => s.showSessionBanner)
  const setDialogOpen = useAppStore((s) => s.setNewAgentDialogOpen)
  const _terminals = useAppStore((s) => s.terminals)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen)
  const isShortcutsPanelOpen = useAppStore((s) => s.isShortcutsPanelOpen)
  const isOnboardingOpen = useAppStore((s) => s.isOnboardingOpen)
  const toggleTerminalPanel = useAppStore((s) => s.toggleTerminalPanel)
  const isTerminalPanelOpen = useAppStore((s) => s.isTerminalPanelOpen)
  const layoutMode = useAppStore((s) => s.config?.defaults?.layoutMode ?? 'grid')
  const mainViewMode = useAppStore((s) => s.config?.defaults?.mainViewMode ?? 'sessions')
  const setMainViewMode = useAppStore((s) => s.setMainViewMode)
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const _activeProject = useAppStore((s) => s.activeProject)
  const _taskCount = useAppStore((s) => {
    const tasks = s.config?.tasks || []
    return tasks.filter((t) => !s.activeProject || t.projectName === s.activeProject).length
  })
  const [recentOpen, setRecentOpen] = useState(false)

  useKeyboardShortcuts()
  useGitDiffPolling()

  // Load config and previous sessions on mount
  useEffect(() => {
    ;(async () => {
      try {
        const config = await window.api.loadConfig()
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

        const prev = await window.api.getPreviousSessions()
        if (prev && prev.length > 0) {
          if (config.defaults.reopenSessions) {
            // Auto-restore sessions — prefer hook-correlated session ID (exact),
            // fall back to scanning agent history when hooks weren't active.
            for (const s of prev) {
              let resumeSessionId: string | undefined
              if (s.hookSessionId) {
                resumeSessionId = s.hookSessionId
              } else {
                const recentSessions = await window.api.getRecentSessions(s.projectPath)
                const match = recentSessions.find((r) => r.agentType === s.agentType)
                if (match) resumeSessionId = match.sessionId
              }
              const session = await window.api.createTerminal({
                agentType: s.agentType,
                projectName: s.projectName,
                projectPath: s.projectPath,
                branch: s.isWorktree ? s.branch : undefined,
                useWorktree: s.isWorktree || undefined,
                remoteHostId: s.remoteHostId,
                resumeSessionId
              })
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

    return () => {
      removeExitListener()
      removeConfigListener()
      removeMenuListener()
      removeSchedulerListener()
      removeWidgetSelectListener()
      removeUpdateListener()
    }
  }, [])

  return (
    <div className="flex h-screen text-gray-100" style={{ background: '#1a1a1e' }}>
      <ProjectSidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — single line, same height as traffic lights */}
        <div
          className="titlebar-drag shrink-0 border-b border-white/[0.06]
                        h-[52px] flex items-center justify-between px-4"
          style={!isSidebarOpen ? { paddingLeft: '80px' } : undefined}
        >
          <div className="flex items-center gap-2.5 titlebar-no-drag">
            {!isSidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="text-gray-400 hover:text-white p-1 rounded-md transition-colors flex items-center gap-1.5"
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
                <KbdHint shortcutId="toggle-sidebar" />
              </button>
            )}
            {/* Main view toggle: Sessions / Tasks */}
            <div className="flex bg-white/[0.04] rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => setMainViewMode('sessions')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  mainViewMode === 'sessions'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Monitor size={13} strokeWidth={2} />
                Sessions
                <KbdHint shortcutId="view-sessions" />
              </button>
              <button
                onClick={() => setMainViewMode('tasks')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  mainViewMode === 'tasks'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <ListTodo size={13} strokeWidth={2} />
                Tasks
                <KbdHint shortcutId="view-tasks" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 titlebar-no-drag">
            {mainViewMode === 'sessions' ? (
              <>
                <GridToolbar />
                <button
                  onClick={toggleTerminalPanel}
                  className={`p-1.5 rounded-md transition-colors ${
                    isTerminalPanelOpen
                      ? 'text-white bg-white/[0.1]'
                      : 'text-gray-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.1]'
                  }`}
                  title="Toggle terminal panel"
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
                <div className="relative">
                  <button
                    onClick={() => setRecentOpen(!recentOpen)}
                    className="p-1.5 text-gray-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.1]
                               rounded-md transition-colors"
                    title="Recent sessions"
                  >
                    <RotateCcw size={16} strokeWidth={1.5} />
                  </button>
                  <RecentSessionsPopover isOpen={recentOpen} onClose={() => setRecentOpen(false)} />
                </div>
                <button
                  onClick={() => setDialogOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-200
                             hover:text-white bg-white/[0.06] hover:bg-white/[0.1]
                             rounded-md transition-colors flex items-center gap-2"
                >
                  + New Session
                  <KbdHint shortcutId="new-session" />
                </button>
              </>
            ) : (
              <>
                <TaskToolbar />
                <button
                  onClick={toggleTerminalPanel}
                  className={`p-1.5 rounded-md transition-colors ${
                    isTerminalPanelOpen
                      ? 'text-white bg-white/[0.1]'
                      : 'text-gray-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.1]'
                  }`}
                  title="Toggle terminal panel"
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
                <button
                  onClick={() => useAppStore.getState().setTaskDialogOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-200
                             hover:text-white bg-white/[0.06] hover:bg-white/[0.1]
                             rounded-md transition-colors flex items-center gap-2"
                >
                  <Plus size={14} strokeWidth={2} />
                  Add Task
                </button>
              </>
            )}
            <WindowControls />
          </div>
        </div>

        {showBanner && <SessionRestoredBanner />}
        <UpdateBanner />
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 h-full">
            {mainViewMode === 'tasks' ? (
              <TaskBoardView />
            ) : layoutMode === 'tabs' ? (
              <TabView />
            ) : (
              <GridView />
            )}
          </div>
          {mainViewMode === 'tasks' && selectedTaskId && <TaskDetailPanel />}
        </div>
        <TerminalPanel />
      </main>

      {/* Focus overlay — no AnimatePresence so terminal handoff is instant */}
      {focusedId && <FocusedTerminal />}

      <PromptLauncher mode="overlay" onClose={() => setDialogOpen(false)} />
      <AddProjectDialog />
      <WorkflowEditor />
      <CommandPalette />
      <AddTaskDialog />
      <WorktreeCleanupDialog />
      <MissedScheduleDialog />
      <DiffSidebar />

      <AnimatePresence>{isShortcutsPanelOpen && <KeyboardShortcutsPanel />}</AnimatePresence>

      <AnimatePresence>{isSettingsOpen && <SettingsPage />}</AnimatePresence>

      <AnimatePresence>{isOnboardingOpen && <OnboardingModal />}</AnimatePresence>

      <ToastContainer />
    </div>
  )
}
