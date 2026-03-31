import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { ProjectItem } from './ProjectItem'
import { ProjectsSectionToolbar } from './ProjectsSectionToolbar'
import { ChevronRight, FolderPlus, Monitor } from 'lucide-react'
import type { ProjectConfig } from '../../../shared/types'
import type { SidebarSessionInfo } from './types'

const EMPTY_SESSIONS: SidebarSessionInfo[] = []

export function ProjectsSection({
  isCollapsed,
  workspaceProjects,
  projectTerminals,
  worktreeSessionCounts,
  mainRepoSessionCounts,
  workspaceTerminalCount
}: {
  isCollapsed: boolean
  workspaceProjects: ProjectConfig[]
  projectTerminals: Map<string, SidebarSessionInfo[]>
  worktreeSessionCounts: Map<string, number>
  mainRepoSessionCounts: Map<string, number>
  workspaceTerminalCount: number
}) {
  const activeProject = useAppStore((s) => s.activeProject)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const setAddProjectDialogOpen = useAppStore((s) => s.setAddProjectDialogOpen)
  const sidebarProjectSort = useAppStore((s) => s.sidebarProjectSort)
  const sidebarWorktreeSort = useAppStore((s) => s.sidebarWorktreeSort)
  const sidebarWorktreeFilter = useAppStore((s) => s.sidebarWorktreeFilter)
  const reorderProjects = useAppStore((s) => s.reorderProjects)
  const terminals = useAppStore((s) => s.terminals)

  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)

  const iconSize = isCollapsed ? 22 : 14

  const sortedProjects = useMemo(() => {
    if (sidebarProjectSort === 'manual') return workspaceProjects
    if (sidebarProjectSort === 'name') {
      return [...workspaceProjects].sort((a, b) => a.name.localeCompare(b.name))
    }
    // 'recent' — sort by most recent session activity
    return [...workspaceProjects].sort((a, b) => {
      let aMax = 0
      let bMax = 0
      for (const t of terminals.values()) {
        if (t.session.projectName === a.name && t.lastOutputTimestamp > aMax)
          aMax = t.lastOutputTimestamp
        if (t.session.projectName === b.name && t.lastOutputTimestamp > bMax)
          bMax = t.lastOutputTimestamp
      }
      return bMax - aMax
    })
  }, [workspaceProjects, sidebarProjectSort, terminals])

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (sidebarProjectSort !== 'manual') return
      setDragSourceIndex(index)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    },
    [sidebarProjectSort]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (sidebarProjectSort !== 'manual') return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverIndex(index)
    },
    [sidebarProjectSort]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault()
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        reorderProjects(fromIndex, toIndex)
      }
      setDragSourceIndex(null)
      setDragOverIndex(null)
    },
    [reorderProjects]
  )

  const handleDragEnd = useCallback(() => {
    setDragSourceIndex(null)
    setDragOverIndex(null)
  }, [])

  return (
    <>
      {!isCollapsed && (
        <div className="group/section px-3 pt-3 pb-1.5 flex items-center justify-between">
          <button
            onClick={() => setSectionCollapsed(!sectionCollapsed)}
            className="flex items-center gap-1.5 hover:text-gray-300 transition-colors"
          >
            <ChevronRight
              size={10}
              strokeWidth={2}
              className={`text-gray-600 transition-transform ${sectionCollapsed ? '' : 'rotate-90'}`}
            />
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Projects
            </span>
          </button>
          <div className="flex items-center gap-0.5">
            <ProjectsSectionToolbar />
            <Tooltip label="Add project" position="bottom">
              <button
                onClick={() => setAddProjectDialogOpen(true)}
                className="p-0.5 rounded text-gray-600 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <FolderPlus size={13} strokeWidth={1.5} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      {!sectionCollapsed && (
        <button
          onClick={() => setActiveProject(null)}
          className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-2 ${
            activeProject === null
              ? 'bg-white/[0.08] text-white'
              : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'All Projects' : undefined}
        >
          <Monitor size={iconSize} strokeWidth={1.5} className="shrink-0" />
          {!isCollapsed && (
            <>
              All Projects
              <span className="text-gray-500 text-xs ml-auto">{workspaceTerminalCount}</span>
            </>
          )}
        </button>
      )}
      {!isCollapsed && !sectionCollapsed && workspaceProjects.length === 0 && (
        <p className="text-[13px] text-gray-600 px-2.5 py-1">No projects</p>
      )}

      {!sectionCollapsed &&
        sortedProjects.map((project, index) => {
          const sessionCount = (projectTerminals.get(project.name) ?? EMPTY_SESSIONS).length
          const isManual = sidebarProjectSort === 'manual'
          return (
            <div
              key={project.name}
              draggable={isManual && !isCollapsed}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`${isManual && !isCollapsed ? 'cursor-grab active:cursor-grabbing' : ''} ${
                dragOverIndex === index && dragSourceIndex !== index
                  ? 'border-t-2 border-blue-500'
                  : 'border-t-2 border-transparent'
              }`}
            >
              <ProjectItem
                project={project}
                sessionCount={sessionCount}
                defaultExpanded={sessionCount > 0}
                isActive={activeProject === project.name}
                isCollapsed={isCollapsed}
                worktreeSessionCounts={worktreeSessionCounts}
                mainRepoSessionCount={mainRepoSessionCounts.get(project.name) || 0}
                worktreeFilter={sidebarWorktreeFilter}
                worktreeSort={sidebarWorktreeSort}
              />
            </div>
          )
        })}
    </>
  )
}
