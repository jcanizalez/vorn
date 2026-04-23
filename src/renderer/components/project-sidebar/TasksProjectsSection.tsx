import { useState } from 'react'
import { useAppStore } from '../../stores'
import { ChevronRight, Layers } from 'lucide-react'
import { ProjectIcon } from './ProjectIcon'
import { SidebarNavItem } from './SidebarNavItem'
import type { ProjectConfig } from '../../../shared/types'

export function TasksProjectsSection({
  isCollapsed,
  workspaceProjects
}: {
  isCollapsed: boolean
  workspaceProjects: ProjectConfig[]
}) {
  const activeProject = useAppStore((s) => s.activeProject)
  const setActiveProject = useAppStore((s) => s.setActiveProject)

  const [sectionCollapsed, setSectionCollapsed] = useState(false)

  const iconSize = isCollapsed ? 22 : 14

  return (
    <>
      {!isCollapsed && (
        <div className="group/section pt-3 pb-1.5 flex items-center justify-between">
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
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      {!sectionCollapsed && (
        <SidebarNavItem
          isActive={activeProject === null}
          isCollapsed={isCollapsed}
          icon={<Layers size={iconSize} strokeWidth={1.5} className="shrink-0" />}
          label="All Projects"
          onClick={() => setActiveProject(null)}
        />
      )}

      {!isCollapsed && !sectionCollapsed && workspaceProjects.length === 0 && (
        <p className="text-[13px] text-gray-600 px-2.5 py-1">No projects</p>
      )}

      {!sectionCollapsed &&
        workspaceProjects.map((project) => (
          <SidebarNavItem
            key={project.name}
            isActive={activeProject === project.name}
            isCollapsed={isCollapsed}
            icon={<ProjectIcon icon={project.icon} color={project.iconColor} size={iconSize} />}
            label={project.name}
            onClick={() => setActiveProject(project.name)}
          />
        ))}
    </>
  )
}
