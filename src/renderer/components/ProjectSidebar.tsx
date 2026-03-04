import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../stores'
import { ShortcutConfig, ProjectConfig, AgentStatus, AgentType } from '../../shared/types'
import { getDisplayName } from '../lib/terminal-display'
import { KbdHint } from './KbdHint'
import { Tooltip } from './Tooltip'
import { AgentIcon } from './AgentIcon'
import {
  Folder, FolderGit2, Code, Globe, Database, Server, Smartphone, Package,
  FileCode, Terminal, Cpu, Cloud, Shield, Zap, Gamepad2, Music, Image,
  BookOpen, FlaskConical, Rocket, Play, MoreHorizontal, Pencil, Trash2, GitFork, ChevronRight
} from 'lucide-react'

const STATUS_DOT_COLOR: Record<AgentStatus, string> = {
  running: 'bg-green-400',
  waiting: 'bg-amber-400',
  idle: 'bg-gray-500',
  error: 'bg-red-400'
}

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string; strokeWidth?: number }>> = {
  Folder, FolderGit2, Code, Globe, Database, Server, Smartphone, Package,
  FileCode, Terminal, Cpu, Cloud, Shield, Zap, Gamepad2, Music, Image,
  BookOpen, FlaskConical, Rocket
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.5">
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
      style={{ background: 'rgba(12, 16, 28, 0.98)' }}
    >
      <button
        onClick={() => { onEdit(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Pencil size={12} strokeWidth={1.5} />
        Edit Project
      </button>
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:text-red-300
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Trash2 size={12} strokeWidth={1.5} />
        Delete Project
      </button>
    </div>
  )
}

function ShortcutContextMenu({
  onEdit,
  onDelete,
  onClose
}: {
  onEdit: () => void
  onDelete: () => void
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
      className="absolute right-0 top-full mt-1 z-50 min-w-[140px] py-1
                 border border-white/[0.08] rounded-lg shadow-xl"
      style={{ background: 'rgba(12, 16, 28, 0.98)' }}
    >
      <button
        onClick={() => { onEdit(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Pencil size={12} strokeWidth={1.5} />
        Edit Shortcut
      </button>
      <button
        onClick={() => { onDelete(); onClose() }}
        className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:text-red-300
                   hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
      >
        <Trash2 size={12} strokeWidth={1.5} />
        Delete Shortcut
      </button>
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
  const removeShortcut = useAppStore((s) => s.removeShortcut)
  const terminals = useAppStore((s) => s.terminals)
  const setAddProjectDialogOpen = useAppStore((s) => s.setAddProjectDialogOpen)
  const setShortcutDialogOpen = useAppStore((s) => s.setShortcutDialogOpen)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setEditingProject = useAppStore((s) => s.setEditingProject)

  const setEditingShortcut = useAppStore((s) => s.setEditingShortcut)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)

  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [openMenuProject, setOpenMenuProject] = useState<string | null>(null)
  const [openMenuShortcut, setOpenMenuShortcut] = useState<string | null>(null)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const isResizing = useRef(false)
  const widthBeforeCollapse = useRef(256)

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

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
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
  }, [sidebarWidth])

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

  const projectTerminals = new Map<string, { id: string; name: string; status: AgentStatus; agentType: AgentType; branch?: string }[]>()
  for (const [id, t] of terminals) {
    const pName = t.session.projectName
    if (!projectTerminals.has(pName)) projectTerminals.set(pName, [])
    projectTerminals.get(pName)!.push({
      id,
      name: getDisplayName(t.session),
      status: t.status,
      agentType: t.session.agentType,
      branch: t.session.branch
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

  const handleEditProject = (project: ProjectConfig) => {
    setEditingProject(project)
    setAddProjectDialogOpen(true)
  }

  return (
    <div
      className="border-r border-white/[0.06] flex flex-col h-full shrink-0 relative"
      style={{ width: `${sidebarWidth}px`, background: 'rgba(0, 0, 0, 0.2)' }}
    >
      {/* Traffic light safe zone */}
      <div className="titlebar-drag h-[52px] pl-[78px] pr-3 flex items-center justify-end
                      border-b border-white/[0.06] shrink-0">
        {!isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-white titlebar-no-drag p-1 rounded-md transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          {!isCollapsed && (
            <>
              All Projects
              <span className="text-gray-500 text-xs ml-auto">
                {terminals.size}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Section label */}
      {!isCollapsed && (
        <div className="px-3 pt-5 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Projects
          </span>
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      {/* Project list */}
      <div className={`flex-1 overflow-auto space-y-0.5 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
        {!isCollapsed && config?.projects.length === 0 && (
          <p className="text-[13px] text-gray-600 px-2.5 py-1">No projects</p>
        )}
        {config?.projects.map((project) => {
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
                  <ProjectIcon icon={project.icon} color={project.iconColor} size={14} />
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{project.name}</span>
                      {sessions.length > 0 && (
                        <span className="text-gray-600 text-xs ml-auto">
                          {sessions.length}
                        </span>
                      )}
                    </>
                  )}
                </button>
                {!isCollapsed && (
                  <>
                    <Tooltip label="Quick launch session" position="bottom">
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
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-green-400
                                   p-1.5 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                      >
                        <Play size={14} strokeWidth={2} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Launch in worktree (current branch)" position="bottom">
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
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-amber-400
                                   p-1.5 rounded-md hover:bg-white/[0.06] transition-all shrink-0"
                      >
                        <GitFork size={14} strokeWidth={2} />
                      </button>
                    </Tooltip>
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuProject(openMenuProject === project.name ? null : project.name)}
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white
                                   p-1 transition-all shrink-0"
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
                  </>
                )}
              </div>

              {/* Session list under project */}
              {!isCollapsed && isExpanded && (
                <div className="ml-4 pl-2 border-l border-white/[0.04] space-y-0.5 mt-0.5 mb-1">
                  {sessions.length === 0 ? (
                    <p className="text-[11px] text-gray-600 py-0.5 pl-2">No sessions</p>
                  ) : (
                    sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setFocusedTerminal(s.id)}
                        className="w-full text-left px-2 py-1 rounded-md text-[12px] text-gray-400
                                   hover:text-white hover:bg-white/[0.04] transition-colors
                                   flex items-center gap-2 min-w-0"
                      >
                        <span className="relative shrink-0">
                          <AgentIcon agentType={s.agentType} size={14} />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLOR[s.status]}`} />
                        </span>
                        <span className="truncate">{s.name}</span>
                      </button>
                    ))
                  )}
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            <path d="M12 11v6M9 14h6" />
          </svg>
          {!isCollapsed && 'Add Project'}
        </button>
      </div>

      {/* Shortcuts section */}
      {!isCollapsed && (
        <div className="px-3 pt-5 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Shortcuts
          </span>
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      <div className={`overflow-auto space-y-0.5 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
        {!isCollapsed && (!config?.shortcuts || config.shortcuts.length === 0) && (
          <p className="text-[13px] text-gray-600 px-2.5 py-1">No shortcuts</p>
        )}
        {config?.shortcuts?.map((shortcut: ShortcutConfig) => {
          const ShortcutIcon = ICON_MAP[shortcut.icon] || Zap
          return (
            <div key={shortcut.id} className="group relative flex items-center">
              <button
                onClick={async () => {
                  for (const action of shortcut.actions) {
                    const session = await window.api.createTerminal({
                      agentType: action.agentType,
                      projectName: action.projectName,
                      projectPath: action.projectPath,
                      displayName: action.displayName,
                      branch: action.branch,
                      useWorktree: action.useWorktree
                    })
                    addTerminal(session)
                  }
                }}
                className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors
                           flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/[0.04]
                           ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? shortcut.name : undefined}
              >
                <ShortcutIcon size={14} color={shortcut.iconColor || '#6b7280'} strokeWidth={1.5} />
                {!isCollapsed && (
                  <>
                    <span className="truncate">{shortcut.name}</span>
                    <span className="text-gray-600 text-xs ml-auto">{shortcut.actions.length}</span>
                  </>
                )}
              </button>
              {!isCollapsed && (
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuShortcut(openMenuShortcut === shortcut.id ? null : shortcut.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white
                               p-1 transition-all shrink-0"
                  >
                    <MoreHorizontal size={12} strokeWidth={2} />
                  </button>
                  {openMenuShortcut === shortcut.id && (
                    <ShortcutContextMenu
                      onEdit={() => {
                        setEditingShortcut(shortcut)
                        setShortcutDialogOpen(true)
                      }}
                      onDelete={() => removeShortcut(shortcut.id)}
                      onClose={() => setOpenMenuShortcut(null)}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={() => setShortcutDialogOpen(true)}
          className={`w-full px-2.5 py-1.5 text-[13px] text-gray-500 hover:text-white
                     hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2 mt-1
                     ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'Add Shortcut' : undefined}
        >
          <Zap size={14} strokeWidth={1.5} className="shrink-0" />
          {!isCollapsed && 'Add Shortcut'}
        </button>
      </div>

      {/* Bottom — Settings */}
      <div className={`p-3 border-t border-white/[0.06] ${isCollapsed ? 'p-1.5' : ''}`}>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`w-full px-2.5 py-1.5 text-[13px] text-gray-300 hover:text-white
                     hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2
                     ${isCollapsed ? 'justify-center px-0' : ''}`}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
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
      />
    </div>
  )
}
