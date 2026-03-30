import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores'
import { MAIN_WORKTREE_SENTINEL } from '../stores/types'
import type { WorktreeInfo } from '../stores/types'
import { ChevronRight, ChevronDown, Check, Loader2 } from 'lucide-react'

const EMPTY_WORKTREES: WorktreeInfo[] = []

export function ToolbarBreadcrumb() {
  const activeProject = useAppStore((s) => s.activeProject)
  const activeWorktreePath = useAppStore((s) => s.activeWorktreePath)
  const setActiveWorktreePath = useAppStore((s) => s.setActiveWorktreePath)
  const worktreeCache = useAppStore((s) => s.worktreeCache)
  const loadWorktrees = useAppStore((s) => s.loadWorktrees)
  const projects = useAppStore((s) => s.config?.projects)

  const project = projects?.find((p) => p.name === activeProject)
  const projectPath = project?.path
  const isMainWorktree = activeWorktreePath === MAIN_WORKTREE_SENTINEL

  const allWorktrees = projectPath
    ? (worktreeCache.get(projectPath) ?? EMPTY_WORKTREES)
    : EMPTY_WORKTREES
  const activeWorktree = isMainWorktree
    ? allWorktrees.find((wt) => wt.isMain)
    : allWorktrees.find((wt) => wt.path === activeWorktreePath)

  const worktreeName = isMainWorktree ? null : activeWorktree?.name
  const branchName = activeWorktree?.branch
  const branchCwd = isMainWorktree ? projectPath : activeWorktreePath

  const handleBranchChanged = useCallback(() => {
    if (projectPath) loadWorktrees(projectPath)
  }, [loadWorktrees, projectPath])

  if (!activeProject) return null

  return (
    <div className="flex items-center gap-0.5 text-[13px] min-w-0 max-w-[400px]">
      {!activeWorktreePath ? (
        <span className="text-white truncate">{activeProject}</span>
      ) : (
        <>
          <button
            onClick={() => setActiveWorktreePath(null)}
            className="text-gray-500 hover:text-gray-300 transition-colors truncate"
          >
            {activeProject}
          </button>
          {worktreeName && (
            <>
              <ChevronRight size={10} className="text-gray-600 shrink-0 mx-0.5" />
              <span className="text-gray-400 truncate">{worktreeName}</span>
            </>
          )}
          {branchName && branchCwd && projectPath && (
            <>
              <ChevronRight size={10} className="text-gray-600 shrink-0 mx-0.5" />
              <BranchDropdown
                currentBranch={branchName}
                cwd={branchCwd}
                projectPath={projectPath}
                onBranchChanged={handleBranchChanged}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

function BranchDropdown({
  currentBranch,
  cwd,
  projectPath,
  onBranchChanged
}: {
  currentBranch: string
  cwd: string
  projectPath: string
  onBranchChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const switchingRef = useRef(false)
  const openRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    openRef.current = open
  }, [open])

  const handleOpen = useCallback(async () => {
    if (openRef.current) {
      setOpen(false)
      return
    }
    setOpen(true)
    setIsLoading(true)
    try {
      const result = await window.api.listBranches(projectPath)
      setBranches(result.local)
    } catch {
      setBranches([])
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  const handleSwitch = useCallback(
    async (branch: string) => {
      if (branch === currentBranch || switchingRef.current) return
      switchingRef.current = true
      setIsSwitching(true)
      try {
        const ok = await window.api.checkoutBranch(cwd, branch)
        if (ok) onBranchChanged()
      } finally {
        switchingRef.current = false
        setIsSwitching(false)
        setOpen(false)
      }
    },
    [cwd, currentBranch, onBranchChanged]
  )

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={handleOpen}
        className={`flex items-center gap-0.5 transition-colors rounded px-1 -mx-1 ${
          open ? 'text-white bg-white/[0.08]' : 'text-white hover:bg-white/[0.06]'
        }`}
      >
        <span className="truncate max-w-[120px]">{currentBranch}</span>
        <ChevronDown size={10} className="text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-[#1e1e22] border border-white/[0.08] rounded-lg shadow-xl z-50 min-w-[180px] max-w-[280px] max-h-[300px] overflow-auto py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 size={14} className="animate-spin text-gray-500" />
            </div>
          ) : branches.length === 0 ? (
            <div className="text-gray-500 text-[12px] px-3 py-2">No branches found</div>
          ) : (
            branches.map((branch) => (
              <button
                key={branch}
                onClick={() => handleSwitch(branch)}
                disabled={isSwitching}
                className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 transition-colors ${
                  branch === currentBranch
                    ? 'text-white bg-white/[0.04]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                } ${isSwitching ? 'opacity-50' : ''}`}
              >
                <span className="w-3 shrink-0">
                  {branch === currentBranch && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="truncate">{branch}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
