import { useState } from 'react'
import { FolderGit2, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { toast } from '../Toast'
import { requestWorktreeDelete } from '../WorktreeCleanupDialog'
import type { WorktreeInfo } from '../../stores/types'

export function WorktreeItem({
  worktree,
  projectPath,
  projectName,
  isActiveWorktree,
  sessionCount,
  onSelect,
  onWorktreesChanged
}: {
  worktree: WorktreeInfo
  projectPath: string
  projectName: string
  isActiveWorktree: boolean
  sessionCount: number
  onSelect: () => void
  onWorktreesChanged: () => void
}) {
  const addTerminal = useAppStore((s) => s.addTerminal)
  const config = useAppStore((s) => s.config)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const wt = worktree

  if (renaming) {
    return (
      <div className="group/wt flex items-center">
        <form
          className="flex-1 flex items-center gap-2 px-2 py-1.5 min-w-0"
          onSubmit={async (e) => {
            e.preventDefault()
            const trimmed = renameValue.trim()
            if (trimmed && trimmed !== wt.branch) {
              const ok = await window.api.renameWorktreeBranch(wt.path, trimmed)
              if (ok) {
                toast.success('Worktree renamed')
                onWorktreesChanged()
              } else {
                toast.error('Failed to rename worktree')
              }
            }
            setRenaming(false)
          }}
        >
          <FolderGit2 size={14} className="text-gray-500 shrink-0" strokeWidth={1.5} />
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.1] rounded px-1.5 py-0.5 text-[12px] text-white outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="text-gray-400 hover:text-green-400 p-0.5 rounded hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className="text-gray-400 hover:text-red-400 p-0.5 rounded hover:bg-white/[0.08] transition-colors shrink-0"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="group/wt flex items-center">
      <button
        onClick={onSelect}
        className={`flex-1 text-left px-2 py-1.5 rounded-md text-[13px] flex items-center gap-2 min-w-0 transition-colors ${
          isActiveWorktree
            ? 'bg-white/[0.08] text-white'
            : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        <FolderGit2 size={14} className="text-gray-500 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{wt.branch}</span>
        {sessionCount > 0 && (
          <span className="text-gray-600 text-xs ml-auto group-hover/wt:hidden">
            {sessionCount}
          </span>
        )}
        <div className="hidden group-hover/wt:flex items-center gap-0.5 ml-auto">
          <Tooltip label="New session" position="right">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                const agentType = config?.defaults.defaultAgent || 'claude'
                const session = await window.api.createTerminal({
                  agentType,
                  projectName,
                  projectPath,
                  branch: wt.branch,
                  existingWorktreePath: wt.path
                })
                addTerminal(session)
              }}
              className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip label="Rename worktree" position="right">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setRenaming(true)
                setRenameValue(wt.branch)
              }}
              className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors"
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip label="Remove worktree" position="right">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                const { count, sessionIds } = await window.api.getWorktreeActiveSessions(wt.path)
                if (count > 0 || wt.isDirty) {
                  requestWorktreeDelete({
                    projectPath,
                    worktreePath: wt.path,
                    sessionIds
                  })
                } else {
                  const removed = await window.api.removeWorktree(projectPath, wt.path, false)
                  if (removed) {
                    toast.success('Worktree removed')
                    onWorktreesChanged()
                  } else {
                    toast.error('Failed to remove worktree')
                  }
                }
              }}
              className="text-gray-500 hover:text-red-400 p-0.5 rounded hover:bg-white/[0.08] transition-colors"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
      </button>
    </div>
  )
}
