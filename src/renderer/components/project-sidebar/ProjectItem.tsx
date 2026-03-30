import { useState } from 'react'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { toast } from '../Toast'
import { ProjectIcon } from './ProjectIcon'
import { ProjectContextMenu } from './ProjectContextMenu'
import { WorktreeItem } from './WorktreeItem'
import { generateWorktreeName } from '../../lib/worktree-names'
import { ChevronRight, Plus, MoreHorizontal, GitBranch, FolderGit2 } from 'lucide-react'
import type { ProjectConfig } from '../../../shared/types'
import { MAIN_WORKTREE_SENTINEL } from '../../stores/types'
import type { WorktreeInfo } from '../../stores/types'

const EMPTY_WORKTREES: WorktreeInfo[] = []

export function ProjectItem({
  project,
  sessionCount,
  defaultExpanded,
  isActive,
  isCollapsed,
  worktreeSessionCounts,
  mainRepoSessionCount
}: {
  project: ProjectConfig
  sessionCount: number
  defaultExpanded: boolean
  isActive: boolean
  isCollapsed: boolean
  worktreeSessionCounts: Map<string, number>
  mainRepoSessionCount: number
}) {
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const activeWorktreePath = useAppStore((s) => s.activeWorktreePath)
  const setActiveWorktreePath = useAppStore((s) => s.setActiveWorktreePath)
  const worktreeCache = useAppStore((s) => s.worktreeCache)
  const loadWorktrees = useAppStore((s) => s.loadWorktrees)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const config = useAppStore((s) => s.config)
  const setEditingProject = useAppStore((s) => s.setEditingProject)
  const setAddProjectDialogOpen = useAppStore((s) => s.setAddProjectDialogOpen)
  const removeProject = useAppStore((s) => s.removeProject)

  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [openMenu, setOpenMenu] = useState(false)

  const allWorktrees = worktreeCache.get(project.path) ?? EMPTY_WORKTREES
  const mainWt = allWorktrees.find((wt) => wt.isMain)
  const isMainActive = activeWorktreePath === MAIN_WORKTREE_SENTINEL

  const toggleExpanded = () => {
    const expanding = !isExpanded
    if (expanding) loadWorktrees(project.path)
    setIsExpanded(!isExpanded)
  }

  const handleEdit = () => {
    setEditingProject(project)
    setAddProjectDialogOpen(true)
  }

  return (
    <div>
      <div className="group relative flex items-center">
        <button
          onClick={() => setActiveProject(project.name)}
          className={`flex-1 text-left px-2 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-2 ${
            isActive
              ? 'bg-white/[0.08] text-white'
              : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? project.name : undefined}
        >
          {isCollapsed ? (
            <ProjectIcon icon={project.icon} color={project.iconColor} size={22} />
          ) : (
            <div
              className="relative w-[14px] h-[14px] shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded()
              }}
            >
              <span className="group-hover:hidden flex items-center justify-center w-full h-full">
                <ProjectIcon icon={project.icon} color={project.iconColor} size={14} />
              </span>
              <ChevronRight
                size={12}
                strokeWidth={2.5}
                className={`hidden group-hover:block text-gray-500 transition-transform absolute top-[1px] left-[1px] ${isExpanded ? 'rotate-90' : ''}`}
              />
            </div>
          )}
          {!isCollapsed && (
            <>
              <span className="truncate">{project.name}</span>
              {sessionCount > 0 && (
                <span className="text-gray-600 text-xs ml-auto group-hover:hidden">
                  {sessionCount}
                </span>
              )}
              <div className="hidden group-hover:flex items-center gap-0.5 ml-auto">
                <Tooltip label="New worktree" position="right">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      const name = generateWorktreeName()
                      try {
                        const currentBranch = await window.api.getWorktreeBranch(project.path)
                        if (!currentBranch) {
                          toast.error('Could not determine current Git branch')
                          return
                        }
                        await window.api.createWorktree(project.path, currentBranch, name)
                        if (!isExpanded) {
                          toggleExpanded()
                        } else {
                          loadWorktrees(project.path)
                        }
                      } catch {
                        toast.error('Failed to create worktree')
                      }
                    }}
                    className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors"
                  >
                    <FolderGit2 size={14} strokeWidth={1.5} className="text-amber-400/70" />
                  </button>
                </Tooltip>
                <Tooltip label="More" position="right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenu(!openMenu)
                    }}
                    className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors"
                  >
                    <MoreHorizontal size={14} strokeWidth={2} />
                  </button>
                </Tooltip>
              </div>
            </>
          )}
        </button>
        {!isCollapsed && openMenu && (
          <div className="relative">
            <ProjectContextMenu
              project={project}
              onEdit={handleEdit}
              onDelete={() => removeProject(project.name)}
              onClose={() => setOpenMenu(false)}
            />
          </div>
        )}
      </div>

      {!isCollapsed && isExpanded && (
        <div className="ml-4 mt-0.5 mb-1 space-y-0.5">
          {mainWt && (
            <div className="group/main flex items-center">
              <button
                onClick={() => {
                  setActiveProject(project.name)
                  setActiveWorktreePath(isMainActive ? null : MAIN_WORKTREE_SENTINEL)
                }}
                className={`flex-1 text-left px-2 py-1.5 rounded-md text-[13px] flex items-center gap-2 min-w-0 transition-colors ${
                  isMainActive
                    ? 'bg-white/[0.08] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <GitBranch size={14} className="text-gray-500 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{mainWt.branch}</span>
                {mainRepoSessionCount > 0 && (
                  <span className="text-gray-600 text-xs ml-auto group-hover/main:hidden shrink-0">
                    {mainRepoSessionCount}
                  </span>
                )}
                <div className="hidden group-hover/main:flex items-center gap-0.5 ml-auto">
                  <Tooltip label="New session" position="right">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const agentType = config?.defaults.defaultAgent || 'claude'
                        const session = await window.api.createTerminal({
                          agentType,
                          projectName: project.name,
                          projectPath: project.path,
                          branch: mainWt.branch
                        })
                        addTerminal(session)
                      }}
                      className="text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors"
                    >
                      <Plus size={14} strokeWidth={2} />
                    </button>
                  </Tooltip>
                </div>
              </button>
            </div>
          )}
          {allWorktrees.map((wt) =>
            wt.isMain ? null : (
              <WorktreeItem
                key={wt.path}
                worktree={wt}
                projectPath={project.path}
                projectName={project.name}
                isActiveWorktree={activeWorktreePath === wt.path}
                sessionCount={worktreeSessionCounts.get(wt.path) || 0}
                onSelect={() => {
                  setActiveProject(project.name)
                  setActiveWorktreePath(activeWorktreePath === wt.path ? null : wt.path)
                }}
                onWorktreesChanged={() => loadWorktrees(project.path)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
