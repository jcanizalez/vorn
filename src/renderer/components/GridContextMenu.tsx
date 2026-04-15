import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, FolderGit2, Plus, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores'
import { type ProjectConfig } from '../../shared/types'
import { ProjectIcon } from './project-sidebar/ProjectIcon'
import { resolveActiveProject, createSessionFromProject } from '../lib/session-utils'
import { useWorkspaceProjects } from '../hooks/useWorkspaceProjects'

interface Props {
  position: { x: number; y: number }
  onClose: () => void
}

interface SubmenuItem {
  iconElement?: React.ReactNode
  label: string
  detail?: string
  onClick: () => void
  separator?: boolean
}

interface MenuItem {
  icon?: React.FC<{ size?: number; className?: string }>
  iconElement?: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
  separator?: boolean
  submenu?: SubmenuItem[]
  submenuProject?: ProjectConfig
  onSubmenuEnter?: () => void
}

const MENU_WIDTH = 220
const SUBMENU_WIDTH = 220

function estimatePanelHeight(items: { separator?: boolean }[]): number {
  const seps = items.filter((i) => i.separator).length
  return items.length * 32 + seps * 9 + 16
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

  const createSession = (
    p: ProjectConfig,
    opts: {
      branch?: string
      existingWorktreePath?: string
      useWorktree?: boolean
    } = {}
  ): Promise<void> => {
    onClose()
    return createSessionFromProject(p, opts)
  }

  // Returns null for non-git projects (whose worktreeCache entry is never
  // populated because listWorktrees fails). The main worktree is filtered out
  // because plain sessions are reachable by clicking the parent project item.
  const buildWorktreeSubmenu = (p: ProjectConfig): SubmenuItem[] | null => {
    const worktrees = worktreeCache.get(p.path)
    if (!worktrees || worktrees.length === 0) return null
    const nonMain = worktrees.filter((wt) => !wt.isMain)
    const sessionCountByPath = new Map<string, number>()
    for (const [, t] of terminals) {
      const wtPath = t.session.worktreePath
      if (wtPath) sessionCountByPath.set(wtPath, (sessionCountByPath.get(wtPath) ?? 0) + 1)
    }
    const subs: SubmenuItem[] = nonMain.map((wt) => {
      const count = sessionCountByPath.get(wt.path) ?? 0
      const label = wt.name === wt.branch ? wt.name : `${wt.name} (${wt.branch})`
      return {
        iconElement: <FolderGit2 size={12} className="text-amber-400/70" />,
        label,
        detail: count > 0 ? `${count} session${count > 1 ? 's' : ''}` : 'idle',
        onClick: () => createSession(p, { branch: wt.branch, existingWorktreePath: wt.path })
      }
    })
    subs.push({
      iconElement: <Plus size={12} className="text-amber-400/70" />,
      label: 'New worktree',
      onClick: () => createSession(p, { useWorktree: true }),
      separator: subs.length > 0
    })
    return subs
  }

  const items: MenuItem[] = []

  if (project) {
    const quickLabel = activeWorktreePath
      ? activeWt
        ? `New session in ${project.name} / ${activeWt.name}`
        : `New session in ${project.name} (worktree)`
      : `New session in ${project.name}`

    items.push({
      iconElement: activeWorktreePath ? (
        <FolderGit2 size={14} className="text-amber-400" />
      ) : (
        <ProjectIcon icon={project.icon} color={project.iconColor} size={14} />
      ),
      label: quickLabel,
      className: 'text-white font-medium',
      onClick: () =>
        activeWorktreePath
          ? createSession(project, {
              branch: activeWt?.branch,
              existingWorktreePath: activeWorktreePath
            })
          : createSession(project)
    })
  } else {
    items.push({
      icon: Play,
      label: 'New session',
      className: 'text-white font-medium',
      onClick: () => {
        onClose()
        useAppStore.getState().setNewAgentDialogOpen(true)
      }
    })
  }

  const shouldSeparateProjects = items.length > 0 && workspaceProjects.length > 0
  workspaceProjects.forEach((p, i) => {
    items.push({
      iconElement: <ProjectIcon icon={p.icon} color={p.iconColor} size={14} />,
      label: p.name,
      separator: i === 0 && shouldSeparateProjects,
      // Click creates a plain session in the project (main worktree).
      // Hover opens the worktree submenu if the project is a git repo.
      onClick: () => createSession(p),
      submenuProject: p,
      onSubmenuEnter: () => loadWorktrees(p.path)
    })
  })

  items.push({
    icon: Plus,
    label: 'New session...',
    onClick: () => {
      onClose()
      useAppStore.getState().setNewAgentDialogOpen(true)
    },
    separator: true
  })

  const hasSubmenu = (item: MenuItem): boolean =>
    item.submenuProject !== undefined || item.submenu !== undefined

  const menuHeight = estimatePanelHeight(items)
  const left = Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(position.y, window.innerHeight - menuHeight - 8))

  const hoveredItem = hoveredSubmenu !== null ? items[hoveredSubmenu] : null
  const activeSubmenu = hoveredItem
    ? hoveredItem.submenuProject
      ? buildWorktreeSubmenu(hoveredItem.submenuProject)
      : (hoveredItem.submenu ?? null)
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
          return (
            <div key={i}>
              {item.separator && <div className="border-t border-white/[0.06] my-1" />}
              <button
                ref={(el) => {
                  if (el) itemRefs.current.set(i, el)
                  else itemRefs.current.delete(i)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (item.onClick) {
                    item.onClick()
                  } else if (itemHasSubmenu) {
                    clearHideTimeout()
                    setHoveredSubmenu(hoveredSubmenu === i ? null : i)
                    item.onSubmenuEnter?.()
                  }
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
                aria-haspopup={itemHasSubmenu ? 'menu' : undefined}
                aria-expanded={itemHasSubmenu ? hoveredSubmenu === i : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs ${item.className ?? 'text-gray-300'} hover:bg-white/[0.06] transition-colors`}
              >
                {item.iconElement ??
                  (item.icon && (
                    <item.icon size={14} className={item.className ?? 'text-gray-500'} />
                  ))}
                <span className="flex-1 text-left truncate">{item.label}</span>
                {itemHasSubmenu && (
                  <ChevronRight size={11} className="text-gray-600 ml-auto shrink-0" />
                )}
              </button>
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
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation()
                  sub.onClick()
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300
                           hover:bg-white/[0.06] transition-colors"
              >
                {sub.iconElement}
                <span className="flex-1 text-left font-mono truncate">{sub.label}</span>
                {sub.detail && (
                  <span
                    className={`text-[10px] ml-auto shrink-0 ${
                      sub.detail !== 'idle' ? 'text-green-400/70' : 'text-gray-600'
                    }`}
                  >
                    {sub.detail}
                  </span>
                )}
              </button>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
