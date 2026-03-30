import { useMemo } from 'react'
import { useAppStore } from '../../stores'
import { AgentIcon } from '../AgentIcon'
import { Tooltip } from '../Tooltip'
import { supportsExactSessionResume } from '../../../shared/types'
import { ChevronRight, RotateCcw, Play } from 'lucide-react'

export function ArchivedSessionsSection({
  workspaceProjectNames
}: {
  workspaceProjectNames: Set<string>
}) {
  const archivedSessions = useAppStore((s) => s.archivedSessions)
  const showArchivedSessions = useAppStore((s) => s.showArchivedSessions)
  const setShowArchivedSessions = useAppStore((s) => s.setShowArchivedSessions)
  const unarchiveSession = useAppStore((s) => s.unarchiveSession)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)

  const wsArchived = useMemo(
    () => archivedSessions.filter((s) => workspaceProjectNames.has(s.projectName)),
    [archivedSessions, workspaceProjectNames]
  )

  if (wsArchived.length === 0) return null

  return (
    <>
      <div className="pt-5 pb-1.5 flex items-center justify-between">
        <button
          onClick={() => setShowArchivedSessions(!showArchivedSessions)}
          className="flex items-center gap-1.5 hover:text-gray-300 transition-colors"
        >
          <ChevronRight
            size={10}
            strokeWidth={2}
            className={`text-gray-600 transition-transform ${showArchivedSessions ? 'rotate-90' : ''}`}
          />
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Archived
          </span>
          <span className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
            {wsArchived.length}
          </span>
        </button>
      </div>
      {showArchivedSessions && (
        <div className="space-y-0.5">
          {wsArchived.map((session) => (
            <div key={session.id} className="group/archived flex items-center">
              <div
                className="flex-1 px-2.5 py-1.5 rounded-md text-[12px] text-gray-500
                          flex items-center gap-2 min-w-0 opacity-60"
              >
                <AgentIcon agentType={session.agentType} size={14} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{session.displayName || session.projectName}</div>
                  {session.branch && (
                    <div className="text-[10px] text-gray-600 truncate">{session.branch}</div>
                  )}
                </div>
              </div>
              <Tooltip label="Unarchive" position="right">
                <button
                  onClick={() => unarchiveSession(session.id)}
                  className="opacity-0 group-hover/archived:opacity-100 text-gray-600 hover:text-gray-300
                         p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                >
                  <RotateCcw size={11} strokeWidth={2} />
                </button>
              </Tooltip>
              {session.agentSessionId && supportsExactSessionResume(session.agentType) && (
                <Tooltip label="Resume session" position="right">
                  <button
                    onClick={async () => {
                      const agentType = session.agentType
                      const newSession = await window.api.createTerminal({
                        agentType,
                        projectName: session.projectName,
                        projectPath: session.projectPath,
                        resumeSessionId: session.agentSessionId
                      })
                      addTerminal(newSession)
                      await unarchiveSession(session.id)
                      setFocusedTerminal(newSession.id)
                    }}
                    className="opacity-0 group-hover/archived:opacity-100 text-gray-600 hover:text-green-400
                         p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                  >
                    <Play size={11} strokeWidth={2} />
                  </button>
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
