import { useState, useEffect } from 'react'
import { useAppStore } from '../stores'
import { RecentSession } from '../../shared/types'
import { AgentIcon } from './AgentIcon'
import { RotateCcw } from 'lucide-react'
import { resolveProjectName } from '../lib/session-utils'

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}

export function RecentSessionsCard() {
  const config = useAppStore((s) => s.config)
  const activeProject = useAppStore((s) => s.activeProject)
  const addTerminal = useAppStore((s) => s.addTerminal)

  const [sessions, setSessions] = useState<RecentSession[]>([])

  useEffect(() => {
    let projectPath: string | undefined
    if (activeProject && config) {
      const project = config.projects.find((p) => p.name === activeProject)
      if (project) projectPath = project.path
    }

    window.api
      .getRecentSessions(projectPath)
      .then(setSessions)
      .catch(() => setSessions([]))
  }, [activeProject, config])

  const handleResume = async (session: RecentSession): Promise<void> => {
    try {
      const projectName = resolveProjectName(session, config?.projects)
      const result = await window.api.createTerminal({
        agentType: session.agentType,
        projectName,
        projectPath: session.projectPath,
        resumeSessionId: session.sessionId
      })
      addTerminal(result)
    } catch (err) {
      console.error('[RecentSessionsCard] failed to resume session:', err)
    }
  }

  return (
    <div
      className="relative rounded-lg border border-white/[0.06] overflow-hidden flex flex-col
                 hover:border-white/[0.12] transition-colors h-full"
      style={{ background: '#1a1a1e' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] shrink-0">
        <RotateCcw size={14} className="text-gray-500" strokeWidth={1.5} />
        <span className="text-[13px] font-medium text-gray-300">Recent Sessions</span>
        <span className="text-[11px] text-gray-600 truncate">
          {activeProject ? `· ${activeProject}` : '· All Projects'}
        </span>
        {sessions.length > 0 && (
          <span className="text-gray-600 text-xs ml-auto shrink-0">{sessions.length}</span>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: '#141416' }}>
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-xs text-gray-600">No recent sessions</p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {sessions.map((session) => {
              const project = config?.projects.find((p) => p.path === session.projectPath)
              return (
                <button
                  key={session.sessionId}
                  onClick={() => handleResume(session)}
                  className="w-full text-left px-2.5 py-2 rounded-md hover:bg-white/[0.06]
                             transition-colors group flex items-start gap-2"
                >
                  <div className="shrink-0 mt-0.5">
                    <AgentIcon agentType={session.agentType} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-gray-300 truncate leading-tight">
                      {session.display || 'Untitled session'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {!activeProject && project && (
                        <span className="text-[10px] text-gray-600 truncate">{project.name}</span>
                      )}
                      {!activeProject && project && (
                        <span className="text-[10px] text-gray-700">·</span>
                      )}
                      <span className="text-[10px] text-gray-600 shrink-0">
                        {timeAgo(session.timestamp)}
                      </span>
                      <span className="text-[10px] text-gray-700">·</span>
                      <span className="text-[10px] text-gray-600 shrink-0">
                        {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] text-gray-700 opacity-0 group-hover:opacity-100
                                   transition-opacity shrink-0 mt-0.5"
                  >
                    resume
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
