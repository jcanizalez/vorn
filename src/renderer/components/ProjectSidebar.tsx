import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../stores'
import {
  WorkflowDefinition,
  ProjectConfig,
  AgentStatus,
  AgentType,
  TaskConfig
} from '../../shared/types'
import type { WorktreeInfo } from '../stores/types'
import { buildTaskPrompt } from '../../shared/prompt-builder'
import { getDisplayName } from '../lib/terminal-display'
import {
  getTriggerConfig,
  getActionCount,
  isScheduledWorkflow,
  getTriggerLabel
} from '../lib/workflow-helpers'
import { executeWorkflow } from '../lib/workflow-execution'
import { KbdHint } from './KbdHint'
import { Tooltip } from './Tooltip'
import { toast } from './Toast'
import { AgentIcon } from './AgentIcon'
import {
  Folder,
  FolderGit2,
  Code,
  Globe,
  Database,
  Server,
  Smartphone,
  Package,
  FileCode,
  Terminal,
  Cpu,
  Cloud,
  Shield,
  Zap,
  Gamepad2,
  Music,
  Image,
  BookOpen,
  FlaskConical,
  Rocket,
  Play,
  MoreHorizontal,
  Pencil,
  Trash2,
  GitFork,
  ChevronRight,
  Clock,
  Calendar,
  Repeat,
  Power,
  X,
  ListTodo,
  Plus,
  Circle,
  ChevronDown,
  LayoutList,
  Eye,
  Archive,
  RotateCcw
} from 'lucide-react'

const STATUS_DOT_COLOR: Record<AgentStatus, string> = {
  running: 'bg-green-400',
  waiting: 'bg-amber-400',
  idle: 'bg-gray-500',
  error: 'bg-red-400'
}

const EMPTY_WORKTREES: WorktreeInfo[] = []

const ICON_MAP: Record<
  string,
  React.FC<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  Folder,
  FolderGit2,
  Code,
  Globe,
  Database,
  Server,
  Smartphone,
  Package,
  FileCode,
  Terminal,
  Cpu,
  Cloud,
  Shield,
  Zap,
  Gamepad2,
  Music,
  Image,
  BookOpen,
  FlaskConical,
  Rocket
}

const MIN_WIDTH = 180
const MAX_WIDTH = 400
const COLLAPSED_WIDTH = 52
const COLLAPSE_THRESHOLD = 120

function ProjectIcon({ icon, color, size = 14 }: { icon?: string; color?: string; size?: number }) {
  if (icon && ICON_MAP[icon]) {
    const Icon = ICON_MAP[icon]
    return <Icon size={size} color={color || '#6b7280'} strokeWidth={1.5} />
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth="1.5"
    >
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function ProjectContextMenu({
  project,
  onEdit,
  onDelete,
  onClose
}: {
  project: ProjectConfig
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1
                 border border-white/[0.08] rounded-lg shadow-xl"
      style={{ background: '#141416' }}
    >
      <button
        onClick={() => {
          onEdit()
          onClose()
        }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Pencil size={12} strokeWidth={1.5} />
        Edit Project
      </button>
      {confirmDelete ? (
        <button
          onClick={() => {
            onDelete()
            onClose()
            toast.success(`Project "${project.name}" deleted`)
          }}
          className="w-full px-3 py-1.5 text-left text-[13px] text-red-300 bg-red-500/10
                     hover:bg-red-500/20 flex items-center gap-2 transition-colors"
        >
          <Trash2 size={12} strokeWidth={1.5} />
          Confirm delete?
        </button>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:text-red-300
                     hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
        >
          <Trash2 size={12} strokeWidth={1.5} />
          Delete Project
        </button>
      )}
    </div>
  )
}

function ShortcutContextMenu({
  onEdit,
  onDelete,
  onToggleEnabled,
  isScheduled,
  isEnabled,
  onClose
}: {
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled?: () => void
  isScheduled?: boolean
  isEnabled?: boolean
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1
                 border border-white/[0.08] rounded-lg shadow-xl"
      style={{ background: '#141416' }}
    >
      <button
        onClick={() => {
          onEdit()
          onClose()
        }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Pencil size={12} strokeWidth={1.5} />
        Edit Workflow
      </button>
      {isScheduled && onToggleEnabled && (
        <button
          onClick={() => {
            onToggleEnabled()
            onClose()
          }}
          className="w-full px-3 py-1.5 text-left text-[13px] text-gray-300 hover:text-white
                     hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
        >
          <Power size={12} strokeWidth={1.5} />
          {isEnabled ? 'Disable Schedule' : 'Enable Schedule'}
        </button>
      )}
      <button
        onClick={() => {
          onDelete()
          onClose()
        }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:text-red-300
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Trash2 size={12} strokeWidth={1.5} />
        Delete Workflow
      </button>
    </div>
  )
}

function WorkflowSubGroup({
  label,
  icon,
  count,
  defaultCollapsed,
  children
}: {
  label: string
  icon: React.ReactNode
  count: number
  defaultCollapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="mt-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 px-2 py-1 w-full text-left hover:bg-white/[0.04] rounded-md transition-colors"
      >
        <ChevronRight
          size={10}
          strokeWidth={2}
          className={`text-gray-600 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        />
        {icon}
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {count > 0 && (
          <span className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="ml-2 space-y-0.5">
          {count === 0 ? <p className="text-[11px] text-gray-600 py-0.5 pl-2">None</p> : children}
        </div>
      )}
    </div>
  )
}

export function ProjectSidebar() {
  const config = useAppStore((s) => s.config)
  const activeProject = useAppStore((s) => s.activeProject)
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const removeProject = useAppStore((s) => s.removeProject)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const removeWorkflow = useAppStore((s) => s.removeWorkflow)
  const terminals = useAppStore((s) => s.terminals)
  const setAddProjectDialogOpen = useAppStore((s) => s.setAddProjectDialogOpen)
  const setWorkflowEditorOpen = useAppStore((s) => s.setWorkflowEditorOpen)
  const setEditingWorkflowId = useAppStore((s) => s.setEditingWorkflowId)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setEditingProject = useAppStore((s) => s.setEditingProject)

  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)
  const setMainViewMode = useAppStore((s) => s.setMainViewMode)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const setTaskPanelOpen = useAppStore((s) => s.setTaskPanelOpen)
  const setTaskDialogOpen = useAppStore((s) => s.setTaskDialogOpen) // keep for now; TODO cleanup
  const setEditingTask = useAppStore((s) => s.setEditingTask) // keep for now; TODO cleanup
  const archivedSessions = useAppStore((s) => s.archivedSessions)
  const showArchivedSessions = useAppStore((s) => s.showArchivedSessions)
  const setShowArchivedSessions = useAppStore((s) => s.setShowArchivedSessions)
  const loadArchivedSessions = useAppStore((s) => s.loadArchivedSessions)
  const unarchiveSession = useAppStore((s) => s.unarchiveSession)
  const worktreeCache = useAppStore((s) => s.worktreeCache)
  const loadWorktrees = useAppStore((s) => s.loadWorktrees)

  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [openMenuProject, setOpenMenuProject] = useState<string | null>(null)
  const [openMenuShortcut, setOpenMenuShortcut] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set())
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set())
  const [expandedWorktrees, setExpandedWorktrees] = useState<Set<string>>(new Set())
  const [projectsSectionCollapsed, setProjectsSectionCollapsed] = useState(false)
  const [workflowsSectionCollapsed, setWorkflowsSectionCollapsed] = useState(false)
  const isResizing = useRef(false)
  const widthBeforeCollapse = useRef(256)

  // Load archived sessions on mount
  useEffect(() => {
    loadArchivedSessions()
  }, [])

  // Auto-expand projects that have terminals
  useEffect(() => {
    const withTerminals = new Set<string>()
    for (const [, t] of terminals) {
      withTerminals.add(t.session.projectName)
    }
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      for (const name of withTerminals) next.add(name)
      return next
    })
  }, [terminals])

  const isCollapsed = sidebarWidth <= COLLAPSED_WIDTH
  const iconSize = isCollapsed ? 22 : 14

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      isResizing.current = true
      const startX = e.clientX
      const startWidth = sidebarWidth

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        const newWidth = startWidth + delta

        if (newWidth < COLLAPSE_THRESHOLD) {
          setSidebarWidth(COLLAPSED_WIDTH)
        } else {
          setSidebarWidth(Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH))
        }
      }

      const handleUp = () => {
        isResizing.current = false
        document.removeEventListener('pointermove', handleMove)
        document.removeEventListener('pointerup', handleUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('pointermove', handleMove)
      document.addEventListener('pointerup', handleUp)
    },
    [sidebarWidth]
  )

  // Double-click on handle to toggle collapsed
  const handleResizeDoubleClick = useCallback(() => {
    if (isCollapsed) {
      setSidebarWidth(widthBeforeCollapse.current)
    } else {
      widthBeforeCollapse.current = sidebarWidth
      setSidebarWidth(COLLAPSED_WIDTH)
    }
  }, [isCollapsed, sidebarWidth])

  if (!isSidebarOpen) {
    return null
  }

  const projectTerminals = new Map<
    string,
    {
      id: string
      name: string
      status: AgentStatus
      agentType: AgentType
      branch?: string
      isWorktree?: boolean
    }[]
  >()
  for (const [id, t] of terminals) {
    const pName = t.session.projectName
    if (!projectTerminals.has(pName)) projectTerminals.set(pName, [])
    projectTerminals.get(pName)!.push({
      id,
      name: getDisplayName(t.session),
      status: t.status,
      agentType: t.session.agentType,
      branch: t.session.branch,
      isWorktree: t.session.isWorktree
    })
  }

  const toggleProjectExpanded = (name: string): void => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleSessionsCollapsed = (name: string): void => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleTasksCollapsed = (name: string): void => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleWorktreesExpanded = (project: ProjectConfig): void => {
    setExpandedWorktrees((prev) => {
      const next = new Set(prev)
      if (next.has(project.name)) {
        next.delete(project.name)
      } else {
        next.add(project.name)
        loadWorktrees(project.path)
      }
      return next
    })
  }

  const handleEditProject = (project: ProjectConfig) => {
    setEditingProject(project)
    setAddProjectDialogOpen(true)
  }

  return (
    <aside
      role="navigation"
      aria-label="Project sidebar"
      className="border-r border-white/[0.06] flex flex-col h-full shrink-0 relative"
      style={{
        width: `${sidebarWidth}px`,
        background: '#141416',
        transition: isResizing.current ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Traffic light safe zone */}
      <div
        className="titlebar-drag h-[52px] pl-[78px] pr-3 flex items-center justify-end
                      border-b border-white/[0.06] shrink-0"
      >
        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-white titlebar-no-drag p-1 rounded-md transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation items */}
      <div className={`px-3 pt-3 space-y-0.5 ${isCollapsed ? 'px-1.5' : ''}`}>
        <button
          onClick={() => setActiveProject(null)}
          className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-2 ${
            activeProject === null
              ? 'bg-white/[0.08] text-white'
              : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'All Projects' : undefined}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          {!isCollapsed && (
            <>
              All Projects
              <span className="text-gray-500 text-xs ml-auto">{terminals.size}</span>
            </>
          )}
        </button>
      </div>

      {/* Section label */}
      {!isCollapsed && (
        <div className="px-3 pt-5 pb-1.5 flex items-center justify-between">
          <button
            onClick={() => setProjectsSectionCollapsed(!projectsSectionCollapsed)}
            className="flex items-center gap-1.5 hover:text-gray-300 transition-colors"
          >
            <ChevronRight
              size={10}
              strokeWidth={2}
              className={`text-gray-600 transition-transform ${projectsSectionCollapsed ? '' : 'rotate-90'}`}
            />
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Projects
            </span>
          </button>
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      {/* Project list */}
      <div className={`flex-1 overflow-auto space-y-0.5 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
        {!isCollapsed && !projectsSectionCollapsed && config?.projects.length === 0 && (
          <p className="text-[13px] text-gray-600 px-2.5 py-1">No projects</p>
        )}
        {!projectsSectionCollapsed &&
          config?.projects.map((project) => {
            const sessions = projectTerminals.get(project.name) || []
            const isExpanded = expandedProjects.has(project.name)
            return (
              <div key={project.name}>
                <div className="group relative flex items-center">
                  {/* Chevron toggle */}
                  {!isCollapsed && (
                    <button
                      onClick={() => toggleProjectExpanded(project.name)}
                      className="text-gray-600 hover:text-gray-400 p-0.5 shrink-0 transition-colors"
                    >
                      <ChevronRight
                        size={12}
                        strokeWidth={2}
                        className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>
                  )}
                  <button
                    onClick={() => setActiveProject(project.name)}
                    className={`flex-1 text-left px-2 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-2 ${
                      activeProject === project.name
                        ? 'bg-white/[0.08] text-white'
                        : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? project.name : undefined}
                  >
                    <ProjectIcon icon={project.icon} color={project.iconColor} size={iconSize} />
                    {!isCollapsed && (
                      <>
                        <span className="truncate">{project.name}</span>
                        {sessions.length > 0 && (
                          <span className="text-gray-600 text-xs ml-auto">{sessions.length}</span>
                        )}
                      </>
                    )}
                  </button>
                  {!isCollapsed && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Tooltip label="Quick launch session" position="right">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            const agentType = config?.defaults.defaultAgent || 'claude'
                            const session = await window.api.createTerminal({
                              agentType,
                              projectName: project.name,
                              projectPath: project.path
                            })
                            addTerminal(session)
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-green-400
                                   p-1 rounded-md hover:bg-white/[0.06] transition-all"
                        >
                          <Play size={11} strokeWidth={2} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Add task" position="right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveProject(project.name)
                            setMainViewMode('tasks')
                            setSelectedTaskId('new')
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-blue-400
                                   p-1 rounded-md hover:bg-white/[0.06] transition-all"
                        >
                          <ListTodo size={11} strokeWidth={2} />
                        </button>
                      </Tooltip>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenuProject(
                              openMenuProject === project.name ? null : project.name
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white
                                   p-1 transition-all"
                        >
                          <MoreHorizontal size={12} strokeWidth={2} />
                        </button>
                        {openMenuProject === project.name && (
                          <ProjectContextMenu
                            project={project}
                            onEdit={() => handleEditProject(project)}
                            onDelete={() => removeProject(project.name)}
                            onClose={() => setOpenMenuProject(null)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded sub-groups under project */}
                {!isCollapsed && isExpanded && (
                  <div className="ml-4 pl-2 border-l border-white/[0.04] mt-0.5 mb-1 space-y-1">
                    {/* Sessions sub-group */}
                    <div>
                      <div className="group/sessions flex items-center gap-1.5 px-2 py-1">
                        <button
                          onClick={() => toggleSessionsCollapsed(project.name)}
                          className="flex items-center gap-1.5 flex-1 min-w-0"
                        >
                          <ChevronRight
                            size={10}
                            strokeWidth={2}
                            className={`text-gray-600 transition-transform shrink-0 ${collapsedSessions.has(project.name) ? '' : 'rotate-90'}`}
                          />
                          <Terminal size={11} strokeWidth={2} className="text-gray-600 shrink-0" />
                          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                            Sessions
                          </span>
                          {sessions.length > 0 && (
                            <span className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
                              {sessions.length}
                            </span>
                          )}
                        </button>
                        <Tooltip label="Quick launch session" position="right">
                          <button
                            onClick={async () => {
                              const agentType = config?.defaults.defaultAgent || 'claude'
                              const session = await window.api.createTerminal({
                                agentType,
                                projectName: project.name,
                                projectPath: project.path
                              })
                              addTerminal(session)
                            }}
                            className="opacity-0 group-hover/sessions:opacity-100 text-gray-600 hover:text-green-400
                                     p-0.5 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                          >
                            <Play size={12} strokeWidth={2} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Launch in worktree (current branch)" position="right">
                          <button
                            onClick={async () => {
                              const agentType = config?.defaults.defaultAgent || 'claude'
                              const branchResult = await window.api.listBranches(project.path)
                              const branch = branchResult.current || 'main'
                              const session = await window.api.createTerminal({
                                agentType,
                                projectName: project.name,
                                projectPath: project.path,
                                branch,
                                useWorktree: true
                              })
                              addTerminal(session)
                            }}
                            className="opacity-0 group-hover/sessions:opacity-100 text-gray-600 hover:text-amber-400
                                     p-0.5 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                          >
                            <GitFork size={12} strokeWidth={2} />
                          </button>
                        </Tooltip>
                      </div>
                      {!collapsedSessions.has(project.name) && (
                        <div className="space-y-0.5">
                          {sessions.length === 0 ? (
                            <p className="text-[11px] text-gray-600 py-0.5 pl-2">No sessions</p>
                          ) : (
                            sessions.map((s) => (
                              <div key={s.id} className="group/session flex items-center">
                                <button
                                  onClick={() => setFocusedTerminal(s.id)}
                                  className="flex-1 text-left px-2 py-1 rounded-md text-[12px] text-gray-400
                                           hover:text-white hover:bg-white/[0.04] transition-colors
                                           flex items-center gap-2 min-w-0"
                                >
                                  <span className="relative shrink-0">
                                    <AgentIcon agentType={s.agentType} size={14} />
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLOR[s.status]}`}
                                    />
                                  </span>
                                  <span className="truncate">{s.name}</span>
                                  {s.isWorktree && (
                                    <FolderGit2
                                      size={10}
                                      className="text-amber-500 shrink-0 ml-auto"
                                      strokeWidth={1.5}
                                    />
                                  )}
                                </button>
                                <Tooltip label="Close session" position="right">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        await window.api.killTerminal(s.id)
                                      } catch {
                                        // Terminal may already be dead
                                      }
                                      useAppStore.getState().removeTerminal(s.id)
                                    }}
                                    className="opacity-0 group-hover/session:opacity-100 text-gray-600 hover:text-red-400
                                             p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                  >
                                    <X size={12} strokeWidth={2} />
                                  </button>
                                </Tooltip>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Worktrees sub-group */}
                    {(() => {
                      const worktrees = worktreeCache.get(project.path) ?? EMPTY_WORKTREES
                      const isWorktreesExpanded = expandedWorktrees.has(project.name)
                      return (
                        <div>
                          <div className="group/worktrees flex items-center gap-1.5 px-2 py-1">
                            <button
                              onClick={() => toggleWorktreesExpanded(project)}
                              className="flex items-center gap-1.5 flex-1 min-w-0"
                            >
                              <ChevronRight
                                size={10}
                                strokeWidth={2}
                                className={`text-gray-600 transition-transform shrink-0 ${isWorktreesExpanded ? 'rotate-90' : ''}`}
                              />
                              <FolderGit2
                                size={11}
                                strokeWidth={2}
                                className="text-amber-500/60 shrink-0"
                              />
                              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                                Worktrees
                              </span>
                              {worktrees.length > 0 && (
                                <span className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
                                  {worktrees.length}
                                </span>
                              )}
                            </button>
                          </div>
                          {isWorktreesExpanded && (
                            <div className="space-y-0.5">
                              {worktrees.length === 0 ? (
                                <p className="text-[11px] text-gray-600 py-0.5 pl-2">
                                  No worktrees
                                </p>
                              ) : (
                                worktrees.map((wt) => (
                                  <div key={wt.path} className="group/wt flex items-center">
                                    <div className="flex-1 px-2 py-1 rounded-md text-[12px] flex items-center gap-2 min-w-0">
                                      <FolderGit2
                                        size={11}
                                        className="text-amber-500 shrink-0"
                                        strokeWidth={1.5}
                                      />
                                      <span className="text-amber-400 font-mono text-[11px] truncate">
                                        {wt.branch}
                                      </span>
                                      {wt.isDirty && (
                                        <span
                                          className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                                          title={
                                            wt.diffStat
                                              ? `+${wt.diffStat.insertions} -${wt.diffStat.deletions} in ${wt.diffStat.filesChanged} file${wt.diffStat.filesChanged !== 1 ? 's' : ''}`
                                              : 'Has uncommitted changes'
                                          }
                                        />
                                      )}
                                      {wt.linkedSessionId && (
                                        <span
                                          className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"
                                          title="Active session"
                                        />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      {wt.linkedSessionId ? (
                                        <Tooltip label="Focus session" position="right">
                                          <button
                                            onClick={() => setFocusedTerminal(wt.linkedSessionId!)}
                                            className="opacity-0 group-hover/wt:opacity-100 text-gray-600 hover:text-green-400
                                                     p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                          >
                                            <Terminal size={12} strokeWidth={2} />
                                          </button>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip label="Open terminal here" position="right">
                                          <button
                                            onClick={async () => {
                                              const agentType =
                                                config?.defaults.defaultAgent || 'claude'
                                              const session = await window.api.createTerminal({
                                                agentType,
                                                projectName: project.name,
                                                projectPath: project.path,
                                                branch: wt.branch,
                                                existingWorktreePath: wt.path
                                              })
                                              addTerminal(session)
                                            }}
                                            className="opacity-0 group-hover/wt:opacity-100 text-gray-600 hover:text-green-400
                                                     p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                          >
                                            <Play size={12} strokeWidth={2} />
                                          </button>
                                        </Tooltip>
                                      )}
                                      {!wt.linkedSessionId && (
                                        <Tooltip label="Remove worktree" position="right">
                                          <button
                                            onClick={async () => {
                                              if (wt.isDirty) {
                                                const ok = confirm(
                                                  'This worktree has uncommitted changes that will be permanently lost. Remove anyway?'
                                                )
                                                if (!ok) return
                                              }
                                              const removed = await window.api.removeWorktree(
                                                project.path,
                                                wt.path,
                                                wt.isDirty
                                              )
                                              if (removed) {
                                                toast.success('Worktree removed')
                                                loadWorktrees(project.path)
                                              } else {
                                                toast.error('Failed to remove worktree')
                                              }
                                            }}
                                            className="opacity-0 group-hover/wt:opacity-100 text-gray-600 hover:text-red-400
                                                     p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                          >
                                            <Trash2 size={12} strokeWidth={2} />
                                          </button>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Tasks sub-group */}
                    {(() => {
                      const todoTasks = (config?.tasks || []).filter(
                        (t: TaskConfig) => t.projectName === project.name && t.status === 'todo'
                      )
                      const inProgressTasks = (config?.tasks || []).filter(
                        (t: TaskConfig) =>
                          t.projectName === project.name && t.status === 'in_progress'
                      )
                      const inReviewTasks = (config?.tasks || []).filter(
                        (t: TaskConfig) =>
                          t.projectName === project.name && t.status === 'in_review'
                      )
                      const taskCount =
                        todoTasks.length + inProgressTasks.length + inReviewTasks.length
                      const isTasksCollapsed = collapsedTasks.has(project.name)
                      return (
                        <div>
                          <div className="flex items-center justify-between px-2 py-1">
                            <button
                              onClick={() => toggleTasksCollapsed(project.name)}
                              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
                            >
                              <ChevronRight
                                size={10}
                                strokeWidth={2}
                                className={`text-gray-600 transition-transform shrink-0 ${isTasksCollapsed ? '' : 'rotate-90'}`}
                              />
                              <ListTodo
                                size={11}
                                strokeWidth={2}
                                className="text-gray-600 normal-case"
                              />
                              Tasks
                              {taskCount > 0 && (
                                <span className="text-[10px] font-normal text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded-full normal-case">
                                  {taskCount}
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-0.5">
                              <Tooltip label="View all tasks" position="right">
                                <button
                                  onClick={() => {
                                    setActiveProject(project.name)
                                    setMainViewMode('tasks')
                                  }}
                                  className="text-gray-600 hover:text-gray-300 p-0.5 transition-colors"
                                >
                                  <LayoutList size={11} strokeWidth={2} />
                                </button>
                              </Tooltip>
                              <Tooltip label="Add task" position="right">
                                <button
                                  onClick={() => {
                                    setActiveProject(project.name)
                                    setMainViewMode('tasks')
                                    setSelectedTaskId('new')
                                  }}
                                  className="text-gray-600 hover:text-gray-300 p-0.5 transition-colors"
                                >
                                  <Plus size={11} strokeWidth={2} />
                                </button>
                              </Tooltip>
                            </div>
                          </div>
                          {!isTasksCollapsed && (
                            <div className="space-y-0.5">
                              {taskCount === 0 ? (
                                <p className="text-[11px] text-gray-600 py-0.5 pl-2">No tasks</p>
                              ) : (
                                <>
                                  {inProgressTasks.map((task: TaskConfig) => {
                                    const sessionLive = !!(
                                      task.assignedSessionId &&
                                      terminals.has(task.assignedSessionId)
                                    )
                                    const canResume =
                                      !sessionLive && !!task.agentSessionId && !!task.assignedAgent
                                    return (
                                      <div key={task.id} className="group/task flex items-center">
                                        <button
                                          onClick={() => {
                                            setActiveProject(project.name)
                                            setMainViewMode('tasks')
                                            setSelectedTaskId(task.id)
                                          }}
                                          className="flex-1 text-left px-2 py-1 rounded-md text-[12px] text-blue-400/80
                                                 hover:text-blue-300 hover:bg-white/[0.04] transition-colors
                                                 flex items-center gap-2 min-w-0"
                                        >
                                          <Clock size={11} strokeWidth={2} className="shrink-0" />
                                          <span className="truncate">{task.title}</span>
                                        </button>
                                        {sessionLive && (
                                          <Tooltip label="Focus session" position="right">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setFocusedTerminal(task.assignedSessionId!)
                                              }}
                                              className="opacity-0 group-hover/task:opacity-100 text-gray-600 hover:text-violet-400
                                                     p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                            >
                                              <Terminal size={12} strokeWidth={2} />
                                            </button>
                                          </Tooltip>
                                        )}
                                        {canResume && (
                                          <Tooltip label="Resume session" position="right">
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                const agentType = task.assignedAgent!
                                                const session = await window.api.createTerminal({
                                                  agentType,
                                                  projectName: project.name,
                                                  projectPath: project.path,
                                                  branch: task.branch,
                                                  useWorktree: task.useWorktree,
                                                  resumeSessionId: task.agentSessionId
                                                })
                                                addTerminal(session)
                                                useAppStore
                                                  .getState()
                                                  .startTask(
                                                    task.id,
                                                    session.id,
                                                    agentType as AgentType
                                                  )
                                                setFocusedTerminal(session.id)
                                              }}
                                              className="opacity-0 group-hover/task:opacity-100 text-gray-600 hover:text-amber-400
                                                     p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                            >
                                              <Play size={12} strokeWidth={2} />
                                            </button>
                                          </Tooltip>
                                        )}
                                      </div>
                                    )
                                  })}
                                  {inReviewTasks.map((task: TaskConfig) => (
                                    <div key={task.id} className="group/task flex items-center">
                                      <button
                                        onClick={() => {
                                          setActiveProject(project.name)
                                          setMainViewMode('tasks')
                                          setSelectedTaskId(task.id)
                                        }}
                                        className="flex-1 text-left px-2 py-1 rounded-md text-[12px] text-purple-400/80
                                                 hover:text-purple-300 hover:bg-white/[0.04] transition-colors
                                                 flex items-center gap-2 min-w-0"
                                      >
                                        <Eye size={11} strokeWidth={2} className="shrink-0" />
                                        <span className="truncate">{task.title}</span>
                                      </button>
                                    </div>
                                  ))}
                                  {todoTasks
                                    .sort((a: TaskConfig, b: TaskConfig) => a.order - b.order)
                                    .slice(0, 3)
                                    .map((task: TaskConfig) => (
                                      <div key={task.id} className="group/task flex items-center">
                                        <button
                                          onClick={() => {
                                            setActiveProject(project.name)
                                            setMainViewMode('tasks')
                                            setSelectedTaskId(task.id)
                                          }}
                                          className="flex-1 text-left px-2 py-1 rounded-md text-[12px] text-gray-500
                                                 hover:text-gray-300 hover:bg-white/[0.04] transition-colors
                                                 flex items-center gap-2 min-w-0"
                                        >
                                          <Circle
                                            size={11}
                                            strokeWidth={2}
                                            className="shrink-0 text-gray-600"
                                          />
                                          <span className="truncate">{task.title}</span>
                                        </button>
                                        <Tooltip label="Launch task" position="right">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              const agentType =
                                                config?.defaults.defaultAgent || 'claude'
                                              const allTasks = (config?.tasks || []).filter(
                                                (t) => t.projectName === project.name
                                              )
                                              const session = await window.api.createTerminal({
                                                agentType,
                                                projectName: project.name,
                                                projectPath: project.path,
                                                branch: task.branch,
                                                useWorktree: task.useWorktree,
                                                initialPrompt: buildTaskPrompt({
                                                  task,
                                                  project,
                                                  siblingTasks: allTasks
                                                }),
                                                taskId: task.id
                                              })
                                              addTerminal(session)
                                              useAppStore
                                                .getState()
                                                .startTask(
                                                  task.id,
                                                  session.id,
                                                  agentType as AgentType
                                                )
                                            }}
                                            className="opacity-0 group-hover/task:opacity-100 text-gray-600 hover:text-green-400
                                                   p-1 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                                          >
                                            <Play size={12} strokeWidth={2} />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    ))}
                                  {todoTasks.length > 3 && (
                                    <button
                                      onClick={() => {
                                        setActiveProject(project.name)
                                        setMainViewMode('tasks')
                                      }}
                                      className="px-2 py-0.5 text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                                    >
                                      +{todoTasks.length - 3} more...
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}

        {/* Add project */}
        <button
          onClick={() => setAddProjectDialogOpen(true)}
          className={`w-full px-2.5 py-1.5 text-[13px] text-gray-500 hover:text-white
                     hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2 mt-1
                     ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'Add Project' : undefined}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0"
          >
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            <path d="M12 11v6M9 14h6" />
          </svg>
          {!isCollapsed && 'Add Project'}
        </button>

        {/* Workflows section */}
        {!isCollapsed && (
          <div className="pt-5 pb-1.5 flex items-center justify-between">
            <button
              onClick={() => setWorkflowsSectionCollapsed(!workflowsSectionCollapsed)}
              className="flex items-center gap-1.5 hover:text-gray-300 transition-colors"
            >
              <ChevronRight
                size={10}
                strokeWidth={2}
                className={`text-gray-600 transition-transform ${workflowsSectionCollapsed ? '' : 'rotate-90'}`}
              />
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Workflows
              </span>
            </button>
          </div>
        )}
        {isCollapsed && <div className="pt-4" />}

        {!isCollapsed &&
          !workflowsSectionCollapsed &&
          (!config?.workflows || config.workflows.length === 0) && (
            <p className="text-[13px] text-gray-600 px-2.5 py-1">No workflows</p>
          )}
        {(() => {
          const allWorkflows = config?.workflows || []
          const manualWorkflows = allWorkflows.filter((w) => !isScheduledWorkflow(w))
          const scheduledWorkflows = allWorkflows.filter((w) => isScheduledWorkflow(w))

          const renderWorkflow = (wf: WorkflowDefinition) => {
            const WfIcon = ICON_MAP[wf.icon] || Zap
            const isScheduled = isScheduledWorkflow(wf)
            const isDisabled = isScheduled && !wf.enabled
            const scheduleLabel = getTriggerLabel(wf)
            const actionCount = getActionCount(wf)
            return (
              <div
                key={wf.id}
                className={`group relative flex items-center ${isDisabled ? 'opacity-40' : ''}`}
              >
                <button
                  onClick={() => {
                    setEditingWorkflowId(wf.id)
                    setWorkflowEditorOpen(true)
                  }}
                  className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors
                             flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/[0.04]
                             ${isCollapsed ? 'justify-center px-0' : ''}`}
                  title={isCollapsed ? wf.name : undefined}
                >
                  <span className="relative shrink-0">
                    <WfIcon size={iconSize} color={wf.iconColor || '#6b7280'} strokeWidth={1.5} />
                    {isScheduled && !isCollapsed && (
                      <Clock
                        size={7}
                        className="absolute -top-1 -right-1.5 text-blue-400"
                        strokeWidth={2.5}
                      />
                    )}
                  </span>
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{wf.name}</span>
                      <span className="text-gray-600 text-[10px] ml-auto shrink-0">
                        {scheduleLabel || actionCount}
                      </span>
                    </>
                  )}
                </button>
                {!isCollapsed && (
                  <div className="flex items-center">
                    {!isScheduled && (
                      <button
                        onClick={() => executeWorkflow(wf)}
                        className="opacity-0 group-hover:opacity-100 text-green-500 hover:text-green-400
                                   p-1 transition-all shrink-0"
                        title="Run workflow"
                      >
                        <Play size={11} strokeWidth={2.5} />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuShortcut(openMenuShortcut === wf.id ? null : wf.id)
                        }
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white
                                 p-1 transition-all shrink-0"
                      >
                        <MoreHorizontal size={12} strokeWidth={2} />
                      </button>
                      {openMenuShortcut === wf.id && (
                        <ShortcutContextMenu
                          onEdit={() => {
                            setEditingWorkflowId(wf.id)
                            setWorkflowEditorOpen(true)
                          }}
                          onDelete={() => removeWorkflow(wf.id)}
                          isScheduled={isScheduled}
                          isEnabled={wf.enabled}
                          onToggleEnabled={() => {
                            const updated = { ...wf, enabled: !wf.enabled }
                            useAppStore.getState().updateWorkflow(wf.id, updated)
                          }}
                          onClose={() => setOpenMenuShortcut(null)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          return (
            <>
              {/* Manual workflows sub-group */}
              {!isCollapsed && !workflowsSectionCollapsed && allWorkflows.length > 0 && (
                <WorkflowSubGroup
                  label="Manual"
                  icon={<Zap size={11} strokeWidth={2} className="text-gray-600" />}
                  count={manualWorkflows.length}
                  defaultCollapsed={false}
                >
                  {manualWorkflows.map(renderWorkflow)}
                </WorkflowSubGroup>
              )}

              {/* Scheduled workflows sub-group */}
              {!isCollapsed && !workflowsSectionCollapsed && allWorkflows.length > 0 && (
                <WorkflowSubGroup
                  label="Scheduled"
                  icon={<Calendar size={11} strokeWidth={2} className="text-gray-600" />}
                  count={scheduledWorkflows.length}
                  defaultCollapsed={true}
                >
                  {scheduledWorkflows.map(renderWorkflow)}
                </WorkflowSubGroup>
              )}

              {/* Collapsed mode — render all */}
              {isCollapsed && allWorkflows.map(renderWorkflow)}
            </>
          )
        })()}

        <button
          onClick={() => setWorkflowEditorOpen(true)}
          className={`w-full px-2.5 py-1.5 text-[13px] text-gray-500 hover:text-white
                     hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2 mt-1
                     ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'Add Workflow' : undefined}
        >
          <Zap size={iconSize} strokeWidth={1.5} className="shrink-0" />
          {!isCollapsed && 'Add Workflow'}
        </button>

        {/* Archived sessions section */}
        {!isCollapsed && archivedSessions.length > 0 && (
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
                  {archivedSessions.length}
                </span>
              </button>
            </div>
            {showArchivedSessions && (
              <div className="space-y-0.5">
                {archivedSessions.map((session) => (
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
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom — Help & Settings */}
      <div className={`p-3 border-t border-white/[0.06] space-y-0.5 ${isCollapsed ? 'p-1.5' : ''}`}>
        <button
          onClick={() => useAppStore.getState().setOnboardingOpen(true)}
          className={`w-full px-2.5 py-1.5 text-[13px] text-gray-400 hover:text-white
                     hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2
                     ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'Welcome Guide' : undefined}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {!isCollapsed && 'Welcome Guide'}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`w-full px-2.5 py-1.5 text-[13px] text-gray-300 hover:text-white
                     hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2
                     ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          {!isCollapsed && (
            <>
              Settings
              <KbdHint shortcutId="settings" className="ml-auto" />
            </>
          )}
        </button>
      </div>

      {/* Resize handle */}
      <div
        onPointerDown={handleResizeStart}
        onDoubleClick={handleResizeDoubleClick}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize
                   hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors z-10"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
    </aside>
  )
}
