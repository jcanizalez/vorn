import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, GitFork, Plus } from 'lucide-react'
import { useAppStore } from '../stores'
import { resolveActiveProject } from '../lib/session-utils'

interface Props {
  position: { x: number; y: number }
  onClose: () => void
}

interface MenuItem {
  icon: React.FC<{ size?: number; className?: string }>
  label: string
  onClick: () => void
  className?: string
  separator?: boolean
}

export function GridContextMenu({ position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const items: MenuItem[] = [
    {
      icon: Play,
      label: 'New session',
      onClick: async () => {
        onClose()
        const state = useAppStore.getState()
        const project = resolveActiveProject()
        if (!project) {
          state.setNewAgentDialogOpen(true)
          return
        }
        const agentType = state.config?.defaults.defaultAgent || 'claude'
        const session = await window.api.createTerminal({
          agentType,
          projectName: project.name,
          projectPath: project.path
        })
        state.addTerminal(session)
      },
      className: 'text-green-400'
    },
    {
      icon: GitFork,
      label: 'New session in worktree',
      onClick: async () => {
        onClose()
        const state = useAppStore.getState()
        const project = resolveActiveProject()
        if (!project) {
          state.setNewAgentDialogOpen(true)
          return
        }
        const agentType = state.config?.defaults.defaultAgent || 'claude'
        const branchResult = await window.api.listBranches(project.path)
        const branch = branchResult.current || 'main'
        const session = await window.api.createTerminal({
          agentType,
          projectName: project.name,
          projectPath: project.path,
          branch,
          useWorktree: true
        })
        state.addTerminal(session)
      },
      className: 'text-amber-400'
    },
    {
      icon: Plus,
      label: 'New session...',
      onClick: () => {
        onClose()
        useAppStore.getState().setNewAgentDialogOpen(true)
      },
      separator: true
    }
  ]

  const menuWidth = 220
  const separators = items.filter((i) => i.separator).length
  const menuHeight = items.length * 32 + separators * 9 + 16
  const left = Math.max(8, Math.min(position.x, window.innerWidth - menuWidth - 8))
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
        style={{ top, left, background: '#1e1e22', minWidth: menuWidth }}
      >
        {items.map((item, i) => (
          <div key={i}>
            {item.separator && <div className="border-t border-white/[0.06] my-1" />}
            <button
              onClick={(e) => {
                e.stopPropagation()
                item.onClick()
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors"
            >
              <item.icon size={14} className={item.className ?? 'text-gray-500'} />
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
