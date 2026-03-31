import { useAppStore } from '../../stores'
import { AgentIcon } from '../AgentIcon'
import type { SidebarSessionInfo } from './types'

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
      <div className={`status-dot status-${session.status}`} style={{ width: 6, height: 6 }} />
    </button>
  )
}
