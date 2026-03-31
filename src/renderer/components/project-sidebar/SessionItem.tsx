import { useAppStore } from '../../stores'
import { AgentIcon } from '../AgentIcon'
import type { AgentStatus } from '../../../shared/types'
import type { SidebarSessionInfo } from './types'

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string }> = {
  running: { color: 'bg-green-400', label: 'Running' },
  waiting: { color: 'bg-yellow-400', label: 'Waiting' },
  idle: { color: 'bg-gray-500', label: 'Idle' },
  error: { color: 'bg-red-500', label: 'Error' }
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
      className={`w-full text-left px-2 py-1 rounded-md text-[12px] flex items-center gap-2 min-w-0 transition-colors ${
        isFocused
          ? 'bg-white/[0.08] text-white'
          : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <AgentIcon agentType={session.agentType} size={14} />
      <div className="min-w-0 flex-1">
        <div className="truncate">{session.name}</div>
        {showBranch && session.branch && (
          <div className="text-[10px] text-gray-600 truncate">{session.branch}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[session.status].color}`} />
        <span className="text-[10px] text-gray-600">{STATUS_CONFIG[session.status].label}</span>
      </div>
    </button>
  )
}
