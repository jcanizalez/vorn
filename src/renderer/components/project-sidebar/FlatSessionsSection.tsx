import { useMemo } from 'react'
import { useAppStore } from '../../stores'
import { SessionItem } from './SessionItem'
import { ProjectsSectionToolbar } from './ProjectsSectionToolbar'
import { getDisplayName } from '../../lib/terminal-display'
import { ChevronRight, Monitor } from 'lucide-react'
import type { SidebarSessionInfo } from './types'

export function FlatSessionsSection({
  isCollapsed,
  workspaceProjectNames,
  workspaceTerminalCount
}: {
  isCollapsed: boolean
  workspaceProjectNames: Set<string>
  workspaceTerminalCount: number
}) {
  const terminals = useAppStore((s) => s.terminals)
  const activeProject = useAppStore((s) => s.activeProject)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)

  const sessions = useMemo(() => {
    const effectiveProject =
      activeProject && workspaceProjectNames.has(activeProject) ? activeProject : null
    const list: (SidebarSessionInfo & { projectName: string; lastActivity: number })[] = []
    for (const [id, t] of terminals) {
      if (!workspaceProjectNames.has(t.session.projectName)) continue
      if (effectiveProject && t.session.projectName !== effectiveProject) continue
      list.push({
        id,
        name: getDisplayName(t.session),
        status: t.status,
        agentType: t.session.agentType,
        branch: t.session.branch,
        isWorktree: t.session.isWorktree,
        worktreePath: t.session.worktreePath,
        projectName: t.session.projectName,
        lastActivity: t.lastOutputTimestamp
      })
    }
    list.sort((a, b) => b.lastActivity - a.lastActivity)
    return list
  }, [terminals, workspaceProjectNames, activeProject])

  return (
    <>
      {!isCollapsed && (
        <div className="group/section px-3 pt-3 pb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ChevronRight size={10} strokeWidth={2} className="text-gray-600 rotate-90" />
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Sessions
            </span>
          </div>
          <ProjectsSectionToolbar />
        </div>
      )}

      <button
        onClick={() => {
          setActiveProject(null)
          setFocusedTerminal(null)
        }}
        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-2 ${
          activeProject === null
            ? 'bg-white/[0.08] text-white'
            : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
        } ${isCollapsed ? 'justify-center px-0' : ''}`}
        title={isCollapsed ? 'All Projects' : undefined}
      >
        <Monitor size={isCollapsed ? 22 : 14} strokeWidth={1.5} className="shrink-0" />
        {!isCollapsed && (
          <>
            All Projects
            <span className="text-gray-500 text-xs ml-auto">{workspaceTerminalCount}</span>
          </>
        )}
      </button>

      {!isCollapsed && (
        <div className="space-y-0.5 mt-1">
          {sessions.length > 0 ? (
            sessions.map((s) => <SessionItem key={s.id} session={s} showBranch={true} />)
          ) : (
            <p className="text-[11px] text-gray-600 px-2 py-1">No active sessions</p>
          )}
        </div>
      )}
    </>
  )
}
