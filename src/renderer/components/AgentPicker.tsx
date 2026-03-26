import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Bot } from 'lucide-react'
import { AgentType } from '../../shared/types'
import { AgentIcon } from './AgentIcon'

const AGENT_LABELS: Record<AgentType, string> = {
  claude: 'Claude',
  copilot: 'Copilot',
  codex: 'Codex',
  opencode: 'OpenCode',
  gemini: 'Gemini'
}

export function AgentPicker({
  currentAgent,
  onChange,
  installStatus,
  variant = 'compact',
  allowNone = false
}: {
  currentAgent: AgentType | null
  onChange: (agent: AgentType | null) => void
  installStatus: Record<AgentType, boolean>
  variant?: 'compact' | 'form'
  allowNone?: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(true)
  }

  const handleSelect = (agent: AgentType | null) => {
    if (agent && !installStatus[agent]) return
    setOpen(false)
    if (agent !== currentAgent) {
      onChange(agent)
    }
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current && !menuRef.current.contains(target)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const agents = Object.keys(AGENT_LABELS) as AgentType[]

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleTrigger}
        className={
          variant === 'form'
            ? 'w-full flex items-center gap-2 px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md text-white hover:border-white/[0.2] transition-colors'
            : 'flex items-center gap-1.5 hover:bg-white/[0.04] rounded px-1.5 py-0.5 -mx-1.5 transition-colors text-[12px] text-gray-300'
        }
      >
        {currentAgent ? (
          <AgentIcon agentType={currentAgent} size={14} />
        ) : (
          <Bot size={14} className="text-gray-500" />
        )}
        <span className={`flex-1 text-left ${currentAgent ? '' : 'text-gray-600'}`}>
          {currentAgent ? AGENT_LABELS[currentAgent] : 'Unassigned'}
        </span>
        <ChevronDown size={11} className="text-gray-500" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="fixed z-[150] rounded-lg border border-white/[0.1] shadow-2xl py-1"
              style={{
                top: position.top,
                left: position.left,
                minWidth: Math.max(180, position.width),
                background: '#1e1e22'
              }}
            >
              {allowNone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(null)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-500 hover:bg-white/[0.06] transition-colors"
                >
                  <Bot size={14} className="text-gray-600" />
                  <span className="flex-1 text-left italic">None</span>
                  {!currentAgent && <Check size={13} className="text-gray-400" />}
                </button>
              )}
              {agents.map((agent) => {
                const installed = installStatus[agent]
                const isCurrent = agent === currentAgent
                return (
                  <button
                    key={agent}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelect(agent)
                    }}
                    disabled={!installed}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors ${
                      !installed
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-300 hover:bg-white/[0.06] cursor-pointer'
                    }`}
                    title={!installed ? `${agent} is not installed` : undefined}
                  >
                    <AgentIcon agentType={agent} size={14} />
                    <span className="flex-1 text-left">{AGENT_LABELS[agent]}</span>
                    {!installed && <span className="text-[10px] text-gray-600">Not installed</span>}
                    {isCurrent && installed && <Check size={13} className="text-gray-400" />}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
