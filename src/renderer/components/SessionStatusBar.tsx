import { useRef } from 'react'
import { useAppStore } from '../stores'
import { useShallow } from 'zustand/react/shallow'
import { StatusBadge } from './StatusBadge'
import { GitChangesIndicator, BrowseFilesButton } from './GitChangesIndicator'
import { OpenInButton } from './OpenInButton'
import { BranchPicker } from './BranchPicker'
import { useBranchSwitcher } from '../hooks/useBranchSwitcher'
import { GitBranch, FolderGit2, ListTodo, ChevronDown } from 'lucide-react'

interface Props {
  terminalId: string
}

export function SessionStatusBar({ terminalId }: Props) {
  const { terminal, assignedTask } = useAppStore(
    useShallow((s) => ({
      terminal: s.terminals.get(terminalId),
      assignedTask: s.config?.tasks?.find(
        (t) => t.assignedSessionId === terminalId && t.status === 'in_progress'
      )
    }))
  )

  const session = terminal?.session
  const branchCwd = session && (session.worktreePath ?? session.projectPath)

  const branchButtonRef = useRef<HTMLButtonElement>(null)
  const { showPicker, togglePicker, closePicker, isSwitching, selectBranch } = useBranchSwitcher({
    projectPath: session?.projectPath,
    branchCwd,
    branchName: session?.branch
  })

  if (!terminal || !session) return null

  const { projectPath, branch: branchName } = session

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
        {branchName && (
          <div className="flex items-center gap-1 shrink-0">
            {session.isWorktree && session.worktreeName && (
              <>
                <FolderGit2 size={11} className="text-amber-500 shrink-0" strokeWidth={1.5} />
                <span className="font-mono text-amber-400 truncate max-w-[140px]">
                  {session.worktreeName}
                </span>
              </>
            )}
            <div className="relative">
              <button
                ref={branchButtonRef}
                type="button"
                onClick={togglePicker}
                disabled={isSwitching}
                className={`flex items-center gap-1 transition-colors rounded px-1 -mx-1 ${
                  showPicker
                    ? 'text-gray-200 bg-white/[0.08]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]'
                } ${isSwitching ? 'opacity-50' : ''}`}
              >
                <GitBranch size={11} className="text-gray-500 shrink-0" strokeWidth={1.5} />
                <span className="font-mono truncate max-w-[140px]">{branchName}</span>
                <ChevronDown size={10} className="text-gray-500 shrink-0" />
              </button>
              {showPicker && (
                <BranchPicker
                  projectPath={projectPath}
                  currentBranch={branchName}
                  onSelect={selectBranch}
                  onClose={closePicker}
                  anchorRef={branchButtonRef}
                />
              )}
            </div>
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

      <div className="group/status flex items-center gap-2 shrink-0">
        <StatusBadge status={terminal.status} />
        <GitChangesIndicator terminalId={terminalId} />
        <BrowseFilesButton terminalId={terminalId} />
        <OpenInButton projectPath={session.projectPath} direction="up" />
      </div>
    </div>
  )
}
