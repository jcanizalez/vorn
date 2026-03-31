import { X } from 'lucide-react'
import { useAppStore } from '../../stores'
import { AgentIcon } from '../AgentIcon'
import { closeTerminalSession } from '../../lib/terminal-close'
import { toast } from '../Toast'
import type { AgentStatus } from '../../../shared/types'
import type { SidebarSessionInfo } from './types'

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string; pulse: boolean }> = {
  running: { color: 'bg-green-400', label: 'Running', pulse: true },
  waiting: { color: 'bg-yellow-400', label: 'Waiting', pulse: true },
  idle: { color: 'bg-gray-500', label: 'Idle', pulse: false },
  error: { color: 'bg-red-500', label: 'Error', pulse: false }
}

export function SessionItem({
  session,
  showBranch = true
}: {
  session: SidebarSessionInfo
  showBranch?: boolean
}) {
  const focusedTerminalId = useAppStore((s) => s.focusedTerminalId)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)
  const isFocused = focusedTerminalId === session.id

  return (
    <button
      onClick={() => setFocusedTerminal(session.id)}
      className={`group/session w-full text-left px-2 py-1 rounded-md text-[12px] flex items-center gap-2 min-w-0 transition-colors ${
        isFocused
          ? 'bg-white/[0.08] text-white'
          : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <div className="relative shrink-0">
        <AgentIcon agentType={session.agentType} size={14} />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#1a1a2e] ${STATUS_CONFIG[session.status].color}`}
        >
          {STATUS_CONFIG[session.status].pulse && (
            <div
              className={`absolute inset-0 rounded-full ${STATUS_CONFIG[session.status].color} animate-ping opacity-75`}
              style={{ animationDuration: '2s' }}
            />
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate">{session.name}</div>
        {showBranch && session.branch && (
          <div className="text-[10px] text-gray-600 truncate">{session.branch}</div>
        )}
      </div>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation()
          await closeTerminalSession(session.id)
          toast.success('Session closed')
        }}
        className="hidden group-hover/session:block text-gray-500 hover:text-red-400 p-0.5 rounded hover:bg-white/[0.08] transition-colors shrink-0"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </button>
  )
}
