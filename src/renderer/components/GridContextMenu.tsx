import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, FolderGit2, Plus, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores'
import { ProjectIcon } from './project-sidebar/ProjectIcon'
import { resolveActiveProject } from '../lib/session-utils'

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
  onSubmenuEnter?: () => void
}

export function GridContextMenu({ position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const config = useAppStore((s) => s.config)
  const activeProjectName = useAppStore((s) => s.activeProject)
  const activeWorktreePath = useAppStore((s) => s.activeWorktreePath)
  const worktreeCache = useAppStore((s) => s.worktreeCache)
  const loadWorktrees = useAppStore((s) => s.loadWorktrees)
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)

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
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!submenuRef.current || !submenuRef.current.contains(e.target as Node))
      )
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

  let activeWorktreeBranch: string | undefined
  if (activeWorktreePath && project) {
    const cachedWts = worktreeCache.get(project.path)
    const activeWt = cachedWts?.find((wt) => wt.path === activeWorktreePath)
    activeWorktreeBranch = activeWt?.branch
  }

  const items: MenuItem[] = []

  if (project) {
    const quickLabel = activeWorktreePath
      ? activeWorktreeBranch
        ? `New session in ${project.name} on ${activeWorktreeBranch}`
        : `New session in ${project.name} (worktree)`
      : `New session in ${project.name}`

    items.push({
      iconElement: activeWorktreePath ? (
        <FolderGit2 size={14} className="text-amber-400" />
      ) : (
        <ProjectIcon icon={project.icon} color={project.iconColor} size={14} />
      ),
      label: quickLabel,
      className: 'text-green-400',
      onClick: async () => {
        onClose()
        const state = useAppStore.getState()
        const agentType = state.config?.defaults.defaultAgent || 'claude'
        if (activeWorktreePath) {
          const session = await window.api.createTerminal({
            agentType,
            projectName: project.name,
            projectPath: project.path,
            branch: activeWorktreeBranch,
            existingWorktreePath: activeWorktreePath
          })
          state.addTerminal(session)
        } else {
          const session = await window.api.createTerminal({
            agentType,
            projectName: project.name,
            projectPath: project.path
          })
          state.addTerminal(session)
        }
      }
    })
  } else {
    items.push({
      icon: Play,
      label: 'New session',
      className: 'text-green-400',
      onClick: () => {
        onClose()
        useAppStore.getState().setNewAgentDialogOpen(true)
      }
    })
  }

  if (project && activeProjectName) {
    const worktrees = worktreeCache.get(project.path) ?? []
    const worktreeSubmenuItems: SubmenuItem[] = []

    for (const wt of worktrees) {
      let sessionCount = 0
      for (const [, t] of terminals) {
        if (t.session.worktreePath === wt.path) sessionCount++
      }
      worktreeSubmenuItems.push({
        iconElement: <FolderGit2 size={12} className="text-amber-400/70" />,
        label: wt.branch,
        detail: sessionCount > 0 ? `${sessionCount} session${sessionCount > 1 ? 's' : ''}` : 'idle',
        onClick: async () => {
          onClose()
          const state = useAppStore.getState()
          const agentType = state.config?.defaults.defaultAgent || 'claude'
          const session = await window.api.createTerminal({
            agentType,
            projectName: project.name,
            projectPath: project.path,
            branch: wt.branch,
            existingWorktreePath: wt.path
          })
          state.addTerminal(session)
        }
      })
    }

    worktreeSubmenuItems.push({
      iconElement: <Plus size={12} className="text-amber-400/70" />,
      label: 'New worktree',
      onClick: async () => {
        onClose()
        const state = useAppStore.getState()
        const agentType = state.config?.defaults.defaultAgent || 'claude'
        const branchResult = await window.api.listBranches(project.path)
        const branchName = branchResult.current || 'main'
        const session = await window.api.createTerminal({
          agentType,
          projectName: project.name,
          projectPath: project.path,
          branch: branchName,
          useWorktree: true
        })
        state.addTerminal(session)
      },
      separator: worktreeSubmenuItems.length > 0
    })

    items.push({
      iconElement: <FolderGit2 size={14} className="text-amber-400" />,
      label: `New session in ${project.name}...`,
      submenu: worktreeSubmenuItems,
      onSubmenuEnter: () => loadWorktrees(project.path)
    })
  } else if (!activeProjectName && config?.projects) {
    const workspaceProjects = config.projects.filter(
      (p) => (p.workspaceId ?? 'personal') === activeWorkspace
    )

    if (workspaceProjects.length > 0) {
      const projectSubmenuItems: SubmenuItem[] = workspaceProjects.map((p) => ({
        iconElement: <ProjectIcon icon={p.icon} color={p.iconColor} size={12} />,
        label: p.name,
        onClick: async () => {
          onClose()
          const state = useAppStore.getState()
          const agentType = state.config?.defaults.defaultAgent || 'claude'
          const session = await window.api.createTerminal({
            agentType,
            projectName: p.name,
            projectPath: p.path
          })
          state.addTerminal(session)
        }
      }))

      items.push({
        icon: Plus,
        label: 'New session from...',
        submenu: projectSubmenuItems
      })
    }
  }

  items.push({
    icon: Plus,
    label: 'New session...',
    onClick: () => {
      onClose()
      useAppStore.getState().setNewAgentDialogOpen(true)
    },
    separator: true
  })

  const menuWidth = 220
  const separators = items.filter((i) => i.separator).length
  const menuHeight = items.length * 32 + separators * 9 + 16
  const left = Math.max(8, Math.min(position.x, window.innerWidth - menuWidth - 8))
  const top = Math.max(8, Math.min(position.y, window.innerHeight - menuHeight - 8))

  const activeSubmenu = hoveredSubmenu !== null ? items[hoveredSubmenu]?.submenu : null

  let submenuLeft = left + menuWidth + 4
  let submenuTop = top
  const submenuWidth = 220
  if (hoveredSubmenu !== null) {
    const itemEl = itemRefs.current.get(hoveredSubmenu)
    if (itemEl) {
      submenuTop = itemEl.getBoundingClientRect().top
    }
    if (submenuLeft + submenuWidth > window.innerWidth - 8) {
      submenuLeft = left - submenuWidth - 4
    }
    if (activeSubmenu) {
      const subSeps = activeSubmenu.filter((s) => s.separator).length
      const subHeight = activeSubmenu.length * 32 + subSeps * 9 + 16
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
        style={{ top, left, background: '#1e1e22', minWidth: menuWidth }}
      >
        {items.map((item, i) => (
          <div key={i}>
            {item.separator && <div className="border-t border-white/[0.06] my-1" />}
            <button
              ref={(el) => {
                if (el) itemRefs.current.set(i, el)
                else itemRefs.current.delete(i)
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (item.submenu) {
                  clearHideTimeout()
                  setHoveredSubmenu(hoveredSubmenu === i ? null : i)
                  item.onSubmenuEnter?.()
                } else {
                  item.onClick?.()
                }
              }}
              onMouseEnter={() => {
                if (item.submenu) {
                  clearHideTimeout()
                  setHoveredSubmenu(i)
                  item.onSubmenuEnter?.()
                } else {
                  scheduleHide()
                }
              }}
              onMouseLeave={() => {
                if (item.submenu) scheduleHide()
              }}
              aria-haspopup={item.submenu ? 'menu' : undefined}
              aria-expanded={item.submenu ? hoveredSubmenu === i : undefined}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors"
            >
              {item.iconElement ??
                (item.icon && (
                  <item.icon size={14} className={item.className ?? 'text-gray-500'} />
                ))}
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.submenu && (
                <ChevronRight size={11} className="text-gray-600 ml-auto shrink-0" />
              )}
            </button>
          </div>
        ))}
      </motion.div>

      {/* Hover submenu */}
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
            minWidth: submenuWidth
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
