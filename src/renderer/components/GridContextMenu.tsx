import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderGit2, GitBranch, Plus, ChevronRight, Terminal } from 'lucide-react'
import { useAppStore } from '../stores'
import { type ProjectConfig, type AiAgentType } from '../../shared/types'
import { ProjectIcon } from './project-sidebar/ProjectIcon'
import { AgentIcon } from './AgentIcon'
import {
  resolveActiveProject,
  createSessionFromProject,
  createShellInProject
} from '../lib/session-utils'
import { useWorkspaceProjects } from '../hooks/useWorkspaceProjects'

interface Props {
  position: { x: number; y: number }
  onClose: () => void
}

interface SubmenuItem {
  iconElement?: React.ReactNode
  label: string
  detail?: string
  onSession: () => void
  onTerminal: () => void
  separator?: boolean
}

interface MenuItem {
  icon?: React.FC<{ size?: number; className?: string }>
  iconElement?: React.ReactNode
  label: string
  onSession?: () => void
  onTerminal?: () => void
  onClick?: () => void
  className?: string
  separator?: boolean
  shortcut?: string
  submenuProject?: ProjectConfig
  onSubmenuEnter?: () => void
}

const MENU_WIDTH = 240
const SUBMENU_WIDTH = 240

function estimatePanelHeight(items: { separator?: boolean }[]): number {
  const seps = items.filter((i) => i.separator).length
  return items.length * 32 + seps * 9 + 16
}

function DualLaunchButtons({
  defaultAgent,
  onSession,
  onTerminal,
  size = 13
}: {
  defaultAgent: AiAgentType
  onSession: () => void
  onTerminal: () => void
  size?: number
}) {
  return (
    <span className="flex items-center gap-0.5 ml-auto shrink-0">
      <button
        type="button"
        title="New session"
        onClick={(e) => {
          e.stopPropagation()
          onSession()
        }}
        className="p-0.5 rounded hover:bg-white/[0.12] transition-colors text-gray-500 hover:text-white"
      >
        <AgentIcon agentType={defaultAgent} size={size} />
      </button>
      <button
        type="button"
        title="New terminal"
        onClick={(e) => {
          e.stopPropagation()
          onTerminal()
        }}
        className="p-0.5 rounded hover:bg-white/[0.12] transition-colors text-gray-500 hover:text-white"
      >
        <Terminal size={size} strokeWidth={1.5} />
      </button>
    </span>
  )
}

export function GridContextMenu({ position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeWorktreePath = useAppStore((s) => s.activeWorktreePath)
  const worktreeCache = useAppStore((s) => s.worktreeCache)
  const loadWorktrees = useAppStore((s) => s.loadWorktrees)
  const workspaceProjects = useWorkspaceProjects()

  const [hoveredSubmenu, setHoveredSubmenu] = useState<number | null>(null)

  const clearHideTimeout = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current)
      hideTimeout.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimeout()
    hideTimeout.current = setTimeout(() => setHoveredSubmenu(null), 150)
  }, [clearHideTimeout])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || submenuRef.current?.contains(target)) return
      onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handleClick)
      document.removeEventListener('keydown', handleKey)
      clearHideTimeout()
    }
  }, [onClose, clearHideTimeout])

  const project = resolveActiveProject()
  const terminals = useAppStore.getState().terminals

  const activeWt =
    activeWorktreePath && project
      ? worktreeCache.get(project.path)?.find((wt) => wt.path === activeWorktreePath)
      : undefined

  const defaultAgent: AiAgentType = useAppStore.getState().config?.defaults.defaultAgent ?? 'claude'

  const createSession = (
    p: ProjectConfig,
    opts: {
      branch?: string
      existingWorktreePath?: string
      useWorktree?: boolean
    } = {}
  ): void => {
    onClose()
    void createSessionFromProject(p, opts)
  }

  const createTerminal = (cwd?: string): void => {
    onClose()
    void createShellInProject(cwd)
  }

  const buildWorktreeSubmenu = (p: ProjectConfig): SubmenuItem[] | null => {
    const worktrees = worktreeCache.get(p.path)
    if (!worktrees || worktrees.length === 0) return null
    const mainWt = worktrees.find((wt) => wt.isMain)
    const nonMain = worktrees.filter((wt) => !wt.isMain)
    const sessionCountByPath = new Map<string, number>()
    for (const [, t] of terminals) {
      const wtPath = t.session.worktreePath
      if (wtPath) sessionCountByPath.set(wtPath, (sessionCountByPath.get(wtPath) ?? 0) + 1)
    }
    const formatDetail = (path: string): string => {
      const count = sessionCountByPath.get(path) ?? 0
      return count > 0 ? `${count} session${count > 1 ? 's' : ''}` : 'idle'
    }
    const formatLabel = (wt: { name: string; branch: string }): string =>
      wt.name === wt.branch ? wt.name : `${wt.name} (${wt.branch})`

    const subs: SubmenuItem[] = []
    if (mainWt) {
      subs.push({
        iconElement: <GitBranch size={12} className="text-gray-400" />,
        label: mainWt.branch,
        detail: formatDetail(mainWt.path),
        onSession: () =>
          createSession(p, { branch: mainWt.branch, existingWorktreePath: mainWt.path }),
        onTerminal: () => createTerminal(mainWt.path)
      })
    }
    nonMain.forEach((wt, i) => {
      subs.push({
        iconElement: <FolderGit2 size={12} className="text-amber-400/70" />,
        label: formatLabel(wt),
        detail: formatDetail(wt.path),
        onSession: () => createSession(p, { branch: wt.branch, existingWorktreePath: wt.path }),
        onTerminal: () => createTerminal(wt.path),
        separator: i === 0 && mainWt !== undefined
      })
    })
    subs.push({
      iconElement: <Plus size={12} className="text-amber-400/70" />,
      label: 'New worktree',
      onSession: () => createSession(p, { useWorktree: true }),
      onTerminal: () => createSession(p, { useWorktree: true }),
      separator: subs.length > 0
    })
    return subs
  }

  const items: MenuItem[] = []

  // Quick launch in active context — dual action row
  if (project) {
    const quickLabel = activeWorktreePath
      ? `New in ${activeWt?.name ?? 'worktree'}`
      : `New in ${project.name}`
    items.push({
      iconElement: <ProjectIcon icon={project.icon} color={project.iconColor} size={14} />,
      label: quickLabel,
      className: 'text-white font-medium',
      onSession: () =>
        activeWorktreePath
          ? createSession(project, {
              branch: activeWt?.branch,
              existingWorktreePath: activeWorktreePath
            })
          : createSession(project),
      onTerminal: () => createTerminal(activeWorktreePath ?? project.path)
    })
  }

  // Project rows with worktree submenus and dual action buttons
  const shouldSeparateProjects = items.length > 0 && workspaceProjects.length > 0
  workspaceProjects.forEach((p, i) => {
    items.push({
      iconElement: <ProjectIcon icon={p.icon} color={p.iconColor} size={14} />,
      label: p.name,
      separator: i === 0 && shouldSeparateProjects,
      onSession: () => createSession(p),
      onTerminal: () => createTerminal(p.path),
      submenuProject: p,
      onSubmenuEnter: () => loadWorktrees(p.path)
    })
  })

  items.push({
    icon: Plus,
    label: 'New session...',
    shortcut: '⌘N',
    onClick: () => {
      onClose()
      useAppStore.getState().setNewAgentDialogOpen(true)
    },
    separator: true
  })

  const hasSubmenu = (item: MenuItem): boolean => item.submenuProject !== undefined

  const menuHeight = estimatePanelHeight(items)
  const left = Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(position.y, window.innerHeight - menuHeight - 8))

  const hoveredItem = hoveredSubmenu !== null ? items[hoveredSubmenu] : null
  const activeSubmenu = hoveredItem?.submenuProject
    ? buildWorktreeSubmenu(hoveredItem.submenuProject)
    : null

  let submenuLeft = left + MENU_WIDTH + 4
  let submenuTop = top
  if (hoveredSubmenu !== null) {
    const itemEl = itemRefs.current.get(hoveredSubmenu)
    if (itemEl) submenuTop = itemEl.getBoundingClientRect().top
    if (submenuLeft + SUBMENU_WIDTH > window.innerWidth - 8) {
      submenuLeft = left - SUBMENU_WIDTH - 4
    }
    if (activeSubmenu) {
      const subHeight = estimatePanelHeight(activeSubmenu)
      submenuTop = Math.max(8, Math.min(submenuTop, window.innerHeight - subHeight - 8))
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: -4, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="fixed z-[150] rounded-lg border border-white/[0.1] shadow-2xl py-1"
        style={{ top, left, background: '#1e1e22', minWidth: MENU_WIDTH }}
      >
        {items.map((item, i) => {
          const itemHasSubmenu = hasSubmenu(item)
          const hasDualActions = Boolean(item.onSession && item.onTerminal)
          return (
            <div key={i}>
              {item.separator && <div className="border-t border-white/[0.06] my-1" />}
              <div
                ref={(el) => {
                  if (el) itemRefs.current.set(i, el as unknown as HTMLButtonElement)
                  else itemRefs.current.delete(i)
                }}
                onMouseEnter={() => {
                  if (itemHasSubmenu) {
                    clearHideTimeout()
                    setHoveredSubmenu(i)
                    item.onSubmenuEnter?.()
                  } else {
                    scheduleHide()
                  }
                }}
                onMouseLeave={() => {
                  if (itemHasSubmenu) scheduleHide()
                }}
                className={`group/row w-full flex items-center gap-2.5 px-3 py-1.5 text-xs ${item.className ?? 'text-gray-300'} hover:bg-white/[0.06] transition-colors`}
              >
                {item.iconElement ??
                  (item.icon && (
                    <item.icon size={14} className={item.className ?? 'text-gray-500'} />
                  ))}
                {item.onClick ? (
                  <button
                    className="flex-1 text-left truncate"
                    onClick={(e) => {
                      e.stopPropagation()
                      item.onClick!()
                    }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {item.shortcut && (
                  <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                    {item.shortcut}
                  </span>
                )}
                {hasDualActions && !item.onClick && (
                  <DualLaunchButtons
                    defaultAgent={defaultAgent}
                    onSession={item.onSession!}
                    onTerminal={item.onTerminal!}
                  />
                )}
                {itemHasSubmenu && <ChevronRight size={11} className="text-gray-600 shrink-0" />}
              </div>
            </div>
          )
        })}
      </motion.div>

      {activeSubmenu && (
        <motion.div
          ref={submenuRef}
          initial={{ opacity: 0, x: -4, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -4, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          role="menu"
          className="fixed z-[151] rounded-lg border border-white/[0.1] shadow-2xl py-1"
          style={{
            top: submenuTop,
            left: submenuLeft,
            background: '#1e1e22',
            minWidth: SUBMENU_WIDTH
          }}
          onMouseEnter={clearHideTimeout}
          onMouseLeave={scheduleHide}
        >
          {activeSubmenu.map((sub, j) => (
            <div key={j}>
              {sub.separator && <div className="border-t border-white/[0.06] my-1" />}
              <div
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-300
                           hover:bg-white/[0.06] transition-colors"
              >
                {sub.iconElement}
                <span className="flex-1 text-left font-mono truncate">{sub.label}</span>
                {sub.detail && (
                  <span
                    className={`text-[10px] shrink-0 ${
                      sub.detail !== 'idle' ? 'text-green-400/70' : 'text-gray-600'
                    }`}
                  >
                    {sub.detail}
                  </span>
                )}
                <DualLaunchButtons
                  defaultAgent={defaultAgent}
                  onSession={sub.onSession}
                  onTerminal={sub.onTerminal}
                  size={11}
                />
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
