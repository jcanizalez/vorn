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
  workspaceTerminalCount,
  worktreeSessions,
  mainRepoSessions
}: {
  isCollapsed: boolean
  workspaceProjects: ProjectConfig[]
  projectTerminals: Map<string, SidebarSessionInfo[]>
  worktreeSessionCounts: Map<string, number>
  mainRepoSessionCounts: Map<string, number>
  workspaceTerminalCount: number
  worktreeSessions: Map<string, SidebarSessionInfo[]>
  mainRepoSessions: Map<string, SidebarSessionInfo[]>
}) {
  const activeProject = useAppStore((s) => s.activeProject)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const setAddProjectDialogOpen = useAppStore((s) => s.setAddProjectDialogOpen)
  const sidebarViewMode = useAppStore((s) => s.sidebarViewMode)
  const sidebarProjectSort = useAppStore((s) => s.sidebarProjectSort)
  const reorderProjects = useAppStore((s) => s.reorderProjects)
  const terminals = useAppStore((s) => s.terminals)

  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)

  const iconSize = isCollapsed ? 22 : 14

  const projectLastActivity = useMemo(() => {
    if (sidebarProjectSort !== 'recent') return null
    const map = new Map<string, number>()
    for (const t of terminals.values()) {
      const cur = map.get(t.session.projectName) ?? 0
      if (t.lastOutputTimestamp > cur) map.set(t.session.projectName, t.lastOutputTimestamp)
    }
    return map
  }, [sidebarProjectSort, terminals])

  const sortedProjects = useMemo(() => {
    if (sidebarProjectSort === 'manual') return workspaceProjects
    if (sidebarProjectSort === 'name') {
      return [...workspaceProjects].sort((a, b) => a.name.localeCompare(b.name))
    }
    return [...workspaceProjects].sort((a, b) => {
      const aMax = projectLastActivity?.get(a.name) ?? 0
      const bMax = projectLastActivity?.get(b.name) ?? 0
      return bMax - aMax
    })
  }, [workspaceProjects, sidebarProjectSort, projectLastActivity])

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
      if (sidebarProjectSort !== 'manual') return
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        reorderProjects(fromIndex, toIndex)
      }
      setDragSourceIndex(null)
      setDragOverIndex(null)
    },
    [reorderProjects, sidebarProjectSort]
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
                viewMode={sidebarViewMode}
                worktreeSessions={worktreeSessions}
                mainRepoSessions={mainRepoSessions.get(project.name) ?? EMPTY_SESSIONS}
                projectSessions={projectTerminals.get(project.name) ?? EMPTY_SESSIONS}
              />
            </div>
          )
        })}
    </>
  )
}
