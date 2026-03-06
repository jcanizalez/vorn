import { useState } from 'react'
import { useAppStore } from '../stores'
import { RotateCcw, X } from 'lucide-react'

export function SessionRestoredBanner() {
  const previousSessions = useAppStore((s) => s.previousSessions)
  const setSessionBanner = useAppStore((s) => s.setSessionBanner)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const [restoring, setRestoring] = useState(false)

  const handleDismiss = (): void => {
    setSessionBanner(false)
    window.api.clearPreviousSessions()
  }

  const handleRestore = async (): Promise<void> => {
    setRestoring(true)
    for (const prev of previousSessions) {
      // Prefer the hook-correlated session ID (exact match); fall back to
      // scanning the agent's history file when hooks weren't active.
      let resumeSessionId: string | undefined
      if (prev.hookSessionId) {
        resumeSessionId = prev.hookSessionId
      } else {
        const recentSessions = await window.api.getRecentSessions(prev.projectPath)
        const match = recentSessions.find((s) => s.agentType === prev.agentType)
        if (match) resumeSessionId = match.sessionId
      }

      const session = await window.api.createTerminal({
        agentType: prev.agentType,
        projectName: prev.projectName,
        projectPath: prev.projectPath,
        branch: prev.isWorktree ? prev.branch : undefined,
        useWorktree: prev.isWorktree || undefined,
        remoteHostId: prev.remoteHostId,
        resumeSessionId
      })
      addTerminal(session)
    }
    setSessionBanner(false)
    window.api.clearPreviousSessions()
    setRestoring(false)
  }

  return (
    <div className="mx-4 mt-4 px-4 py-3 border border-white/[0.08] bg-white/[0.03]
                    rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <RotateCcw size={16} className="text-gray-400 shrink-0" />
        <p className="text-sm text-gray-300">
          {previousSessions.length} previous session{previousSessions.length !== 1 ? 's' : ''} can
          be restored.
        </p>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="px-3 py-1 text-xs font-medium text-black rounded-md transition-colors"
          style={{ background: '#00FFD4' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#00e6be')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#00FFD4')}
        >
          {restoring ? 'Restoring...' : 'Restore'}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
