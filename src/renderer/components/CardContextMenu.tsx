import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize2, Pencil, Pin, Play, GitFork, X } from 'lucide-react'
import { useAppStore } from '../stores'
import { closeTerminalSession } from '../lib/terminal-close'
import { toast } from './Toast'
import { getDisplayName } from '../lib/terminal-display'

interface Props {
  terminalId: string
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

export function CardContextMenu({ terminalId, position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const terminal = useAppStore((s) => s.terminals.get(terminalId))
  const focusedId = useAppStore((s) => s.focusedTerminalId)

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

  if (!terminal) return null

  const isFocused = focusedId === terminalId
  const isPinned = terminal.session.pinned === true

  const items: MenuItem[] = []

  if (!isFocused) {
    items.push({
      icon: Maximize2,
      label: 'Expand',
      onClick: () => {
        useAppStore.getState().setFocusedTerminal(terminalId)
        onClose()
      }
    })
  }

  items.push({
    icon: Pencil,
    label: 'Rename',
    onClick: () => {
      useAppStore.getState().setRenamingTerminalId(terminalId)
      onClose()
    }
  })

  items.push({
    icon: Pin,
    label: isPinned ? 'Unpin' : 'Pin',
    onClick: () => {
      useAppStore.getState().togglePinned(terminalId)
      onClose()
    },
    className: isPinned ? 'text-amber-400' : undefined
  })

  items.push({
    icon: Play,
    label: 'New session (same project)',
    onClick: async () => {
      onClose()
      const state = useAppStore.getState()
      const agentType = state.config?.defaults.defaultAgent || 'claude'
      const session = await window.api.createTerminal({
        agentType,
        projectName: terminal.session.projectName,
        projectPath: terminal.session.projectPath
      })
      state.addTerminal(session)
    },
    separator: true
  })

  items.push({
    icon: GitFork,
    label: 'New session in worktree',
    onClick: async () => {
      onClose()
      const state = useAppStore.getState()
      const agentType = state.config?.defaults.defaultAgent || 'claude'
      const branchResult = await window.api.listBranches(terminal.session.projectPath)
      const branch = branchResult.current || 'main'
      const session = await window.api.createTerminal({
        agentType,
        projectName: terminal.session.projectName,
        projectPath: terminal.session.projectPath,
        branch,
        useWorktree: true
      })
      state.addTerminal(session)
    },
    className: 'text-amber-400'
  })

  items.push({
    icon: X,
    label: 'Close session',
    onClick: async () => {
      onClose()
      const name = getDisplayName(terminal.session)
      if (focusedId === terminalId) useAppStore.getState().setFocusedTerminal(null)
      await closeTerminalSession(terminalId)
      toast.success(`Session "${name}" closed`)
    },
    separator: true,
    className: 'text-red-400'
  })

  // Clamp position to viewport
  const menuWidth = 220
  const menuHeight = items.length * 32 + 16
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8)
  const top = Math.min(position.y, window.innerHeight - menuHeight - 8)

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
