import { useAppStore } from '../stores'
import { useShallow } from 'zustand/react/shallow'
import { StatusBadge } from './StatusBadge'
import { GitChangesIndicator } from './GitChangesIndicator'
import { OpenInButton } from './OpenInButton'
import { GitBranch, FolderGit2, Server, ListTodo } from 'lucide-react'
import { getBranchLabel } from '../lib/terminal-display'

interface Props {
  terminalId: string
}

export function TabStatusBar({ terminalId }: Props) {
  const { terminal, assignedTask } = useAppStore(
    useShallow((s) => ({
      terminal: s.terminals.get(terminalId),
      assignedTask: s.config?.tasks?.find(
        (t) => t.assignedSessionId === terminalId && t.status === 'in_progress'
      )
    }))
  )

  if (!terminal) return null

  const handleTaskClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const state = useAppStore.getState()
    state.setEditingTask(assignedTask!)
    state.setTaskDialogOpen(true)
  }

  return (
    <div
      className="shrink-0 flex items-center gap-3 px-3 h-[26px] border-t border-white/[0.06] text-[11px]"
      style={{ background: '#1a1a1e' }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {terminal.session.branch && (
          <div className="flex items-center gap-1 shrink-0">
            {terminal.session.isWorktree ? (
              <FolderGit2 size={11} className="text-amber-500 shrink-0" strokeWidth={1.5} />
            ) : (
              <GitBranch size={11} className="text-gray-500 shrink-0" strokeWidth={1.5} />
            )}
            <span
              className={`font-mono truncate max-w-[140px] ${
                terminal.session.isWorktree ? 'text-amber-400' : 'text-gray-400'
              }`}
            >
              {getBranchLabel(terminal.session)}
            </span>
            {terminal.session.isWorktree && (
              <span className="text-[10px] text-amber-500/60">worktree</span>
            )}
          </div>
        )}

        {terminal.session.remoteHostLabel && (
          <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-blue-500/[0.08] border border-blue-500/[0.12]">
            <Server size={10} className="text-blue-400" strokeWidth={2} />
            <span className="text-blue-300 font-medium truncate max-w-[100px]">
              {terminal.session.remoteHostLabel}
            </span>
          </div>
        )}

        {assignedTask && (
          <button
            onClick={handleTaskClick}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full
                       bg-violet-500/10 hover:bg-violet-500/20 transition-colors shrink-0"
          >
            <ListTodo size={10} className="text-violet-400" strokeWidth={2} />
            <span className="text-violet-400 truncate max-w-[120px]">{assignedTask.title}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={terminal.status} />
        <GitChangesIndicator terminalId={terminalId} />
        <OpenInButton projectPath={terminal.session.projectPath} direction="up" />
      </div>
    </div>
  )
}
