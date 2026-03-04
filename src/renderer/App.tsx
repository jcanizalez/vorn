import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores'
import { GridView } from './components/GridView'
import { FocusedTerminal } from './components/FocusedTerminal'
import { ProjectSidebar } from './components/ProjectSidebar'
import { NewAgentDialog } from './components/NewAgentDialog'
import { AddProjectDialog } from './components/AddProjectDialog'
import { AddWorkflowDialog } from './components/AddWorkflowDialog'
import { CommandPalette } from './components/CommandPalette'
import { SessionRestoredBanner } from './components/SessionRestoredBanner'
import { GridToolbar } from './components/GridToolbar'
import { SettingsPage } from './components/SettingsPage'
import { RecentSessionsPopover } from './components/RecentSessionsPopover'
import { RotateCcw } from 'lucide-react'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useGitDiffPolling } from './hooks/useGitDiffPolling'
import { setDefaultFontSize } from './lib/terminal-registry'
import { KbdHint } from './components/KbdHint'
import { WorktreeCleanupDialog } from './components/WorktreeCleanupDialog'
import { DiffSidebar } from './components/DiffSidebar'
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel'
import { MissedScheduleDialog } from './components/MissedScheduleDialog'
import { OnboardingModal } from './components/OnboardingModal'

export function App() {
  const focusedId = useAppStore((s) => s.focusedTerminalId)
  const showBanner = useAppStore((s) => s.showSessionBanner)
  const setDialogOpen = useAppStore((s) => s.setNewAgentDialogOpen)
  const terminals = useAppStore((s) => s.terminals)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen)
  const isShortcutsPanelOpen = useAppStore((s) => s.isShortcutsPanelOpen)
  const isOnboardingOpen = useAppStore((s) => s.isOnboardingOpen)
  const [recentOpen, setRecentOpen] = useState(false)

  useKeyboardShortcuts()
  useGitDiffPolling()

  // Load config and previous sessions on mount
  useEffect(() => {
    (async () => {
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
        useAppStore.getState().setSessionBanner(true, prev)
      }
    })()

    const removeExitListener = window.api.onTerminalExit(({ id }) => {
      useAppStore.getState().updateStatus(id, 'idle')
    })

    const removeConfigListener = window.api.onConfigChanged((config) => {
      useAppStore.getState().setConfig(config)
    })

    const removeMenuListener = window.api.onMenuNewAgent(() => {
      useAppStore.getState().setNewAgentDialogOpen(true)
    })

    // Scheduler: auto-execute workflows when triggered
    const removeSchedulerListener = window.api.onSchedulerExecute(async ({ workflowId }) => {
      const state = useAppStore.getState()
      const workflow = state.config?.shortcuts?.find((s) => s.id === workflowId)
      if (!workflow) return

      for (let i = 0; i < workflow.actions.length; i++) {
        const action = workflow.actions[i]
        if (i > 0 && workflow.staggerDelayMs) {
          await new Promise((r) => setTimeout(r, workflow.staggerDelayMs))
        }
        const session = await window.api.createTerminal({
          agentType: action.agentType,
          projectName: action.projectName,
          projectPath: action.projectPath,
          displayName: action.displayName,
          branch: action.branch,
          useWorktree: action.useWorktree,
          initialPrompt: action.prompt,
          promptDelayMs: action.promptDelayMs
        })
        useAppStore.getState().addTerminal(session)
      }

      // Show notification
      if (Notification.permission === 'granted') {
        new Notification('VibeGrid', {
          body: `Workflow "${workflow.name}" started — ${workflow.actions.length} session${workflow.actions.length !== 1 ? 's' : ''} launched`
        })
      }
    })

    return () => {
      removeExitListener()
      removeConfigListener()
      removeMenuListener()
      removeSchedulerListener()
    }
  }, [])

  return (
    <div className="flex h-screen text-gray-100" style={{ background: 'rgba(3, 7, 18, 0.78)' }}>
      <ProjectSidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — single line, same height as traffic lights */}
        <div className="titlebar-drag shrink-0 border-b border-white/[0.06]
                        h-[52px] flex items-center justify-between px-4"
             style={!isSidebarOpen ? { paddingLeft: '80px' } : undefined}>
          <div className="flex items-center gap-2.5 titlebar-no-drag">
            {!isSidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="text-gray-400 hover:text-white p-1 rounded-md transition-colors flex items-center gap-1.5"
                title="Show sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
                <KbdHint shortcutId="toggle-sidebar" />
              </button>
            )}
            <span className="text-sm text-gray-400">
              {terminals.size} agent{terminals.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 titlebar-no-drag">
            <GridToolbar />
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
          </div>
        </div>

        {showBanner && <SessionRestoredBanner />}
        <GridView />
      </main>

      {/* Focus overlay — no AnimatePresence so terminal handoff is instant */}
      {focusedId && <FocusedTerminal />}

      <NewAgentDialog />
      <AddProjectDialog />
      <AddWorkflowDialog />
      <CommandPalette />
      <WorktreeCleanupDialog />
      <MissedScheduleDialog />
      <DiffSidebar />

      <AnimatePresence>
        {isShortcutsPanelOpen && <KeyboardShortcutsPanel />}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && <SettingsPage />}
      </AnimatePresence>

      <AnimatePresence>
        {isOnboardingOpen && <OnboardingModal />}
      </AnimatePresence>
    </div>
  )
}
