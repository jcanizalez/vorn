import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores'
import { GridView } from './components/GridView'
import { FocusedTerminal } from './components/FocusedTerminal'
import { ProjectSidebar } from './components/ProjectSidebar'
import { PromptLauncher } from './components/PromptLauncher'
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
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" className="text-gray-400">
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        onClick={() => window.api.windowClose()}
        className="w-[46px] h-[32px] flex items-center justify-center hover:bg-red-500/80 transition-colors group"
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-400 group-hover:text-white">
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

    const removeWidgetSelectListener = window.api.onWidgetSelectTerminal((terminalId) => {
      useAppStore.getState().setFocusedTerminal(terminalId)
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
      removeWidgetSelectListener()
    }
  }, [])

  return (
    <div className="flex h-screen text-gray-100" style={{ background: '#1a1a1e' }}>
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
            <WindowControls />
          </div>
        </div>

        {showBanner && <SessionRestoredBanner />}
        <GridView />
      </main>

      {/* Focus overlay — no AnimatePresence so terminal handoff is instant */}
      {focusedId && <FocusedTerminal />}

      <PromptLauncher mode="overlay" onClose={() => setDialogOpen(false)} />
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
