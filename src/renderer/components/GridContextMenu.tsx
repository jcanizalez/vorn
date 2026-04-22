import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Terminal } from 'lucide-react'
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

type LaunchMode = 'session' | 'terminal'

interface MenuItem {
  icon?: React.FC<{ size?: number; className?: string }>
  iconElement?: React.ReactNode
  label: string
  onClick: () => void
  className?: string
  separator?: boolean
  shortcut?: string
}

const MENU_WIDTH = 220

function estimatePanelHeight(items: { separator?: boolean }[], hasToggle: boolean): number {
  const seps = items.filter((i) => i.separator).length
  return items.length * 32 + seps * 9 + 16 + (hasToggle ? 40 : 0)
}

export function GridContextMenu({ position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<LaunchMode>('session')

  const activeWorktreePath = useAppStore((s) => s.activeWorktreePath)
  const worktreeCache = useAppStore((s) => s.worktreeCache)
  const workspaceProjects = useWorkspaceProjects()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
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
    }
  }, [onClose])

  const project = resolveActiveProject()

  const activeWt =
    activeWorktreePath && project
      ? worktreeCache.get(project.path)?.find((wt) => wt.path === activeWorktreePath)
      : undefined

  const defaultAgent: AiAgentType = useAppStore.getState().config?.defaults.defaultAgent ?? 'claude'

  const launchInProject = (p: ProjectConfig): void => {
    if (mode === 'terminal') {
      onClose()
      void createShellInProject(p.path)
    } else {
      onClose()
      void createSessionFromProject(p)
    }
  }

  const items: MenuItem[] = []

  // Quick launch in active context
  if (project) {
    const quickLabel = activeWorktreePath
      ? `New in ${activeWt?.name ?? 'worktree'}`
      : `New in ${project.name}`
    items.push({
      iconElement:
        mode === 'session' ? (
          <AgentIcon agentType={defaultAgent} size={14} />
        ) : (
          <Terminal size={14} className="text-gray-400" />
        ),
      label: quickLabel,
      className: 'text-white font-medium',
      onClick: () => {
        if (mode === 'terminal') {
          onClose()
          const cwd = activeWorktreePath ?? project.path
          void createShellInProject(cwd)
        } else {
          onClose()
          void createSessionFromProject(
            project,
            activeWorktreePath
              ? { branch: activeWt?.branch, existingWorktreePath: activeWorktreePath }
              : {}
          )
        }
      }
    })
  }

  // Project rows
  const shouldSeparateProjects = items.length > 0 && workspaceProjects.length > 0
  workspaceProjects.forEach((p, i) => {
    items.push({
      iconElement: <ProjectIcon icon={p.icon} color={p.iconColor} size={14} />,
      label: p.name,
      separator: i === 0 && shouldSeparateProjects,
      onClick: () => launchInProject(p)
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

  const menuHeight = estimatePanelHeight(items, true)
  const left = Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(position.y, window.innerHeight - menuHeight - 8))

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
        {/* Segmented toggle: Session | Terminal */}
        <div className="px-2 pt-1 pb-1.5">
          <div
            className="flex rounded-md border border-white/[0.08] overflow-hidden"
            role="radiogroup"
            aria-label="Launch type"
          >
            <button
              role="radio"
              aria-checked={mode === 'session'}
              onClick={(e) => {
                e.stopPropagation()
                setMode('session')
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] transition-colors ${
                mode === 'session'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              <AgentIcon agentType={defaultAgent} size={12} />
              Session
            </button>
            <button
              role="radio"
              aria-checked={mode === 'terminal'}
              onClick={(e) => {
                e.stopPropagation()
                setMode('terminal')
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] transition-colors ${
                mode === 'terminal'
                  ? 'bg-white/[0.1] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              <Terminal size={12} />
              Terminal
            </button>
          </div>
        </div>

        {items.map((item, i) => (
          <div key={i}>
            {item.separator && <div className="border-t border-white/[0.06] my-1" />}
            <button
              onClick={(e) => {
                e.stopPropagation()
                item.onClick()
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs ${item.className ?? 'text-gray-300'} hover:bg-white/[0.06] transition-colors`}
            >
              {item.iconElement ??
                (item.icon && (
                  <item.icon size={14} className={item.className ?? 'text-gray-500'} />
                ))}
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] text-gray-600 ml-auto shrink-0">{item.shortcut}</span>
              )}
            </button>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
