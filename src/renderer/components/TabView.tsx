import { useEffect } from 'react'
import { useAppStore } from '../stores'
import { useVisibleTerminals } from '../hooks/useVisibleTerminals'
import { AgentIcon } from './AgentIcon'
import { TerminalInstance } from './TerminalInstance'
import { PromptLauncher } from './PromptLauncher'
import { getDisplayName } from '../lib/terminal-display'
import { closeTerminalSession } from '../lib/terminal-close'
import { AgentStatus } from '../../shared/types'
import { ConfirmPopover } from './ConfirmPopover'
import { toast } from './Toast'

const STATUS_DOT: Record<AgentStatus, string> = {
  running: 'bg-green-500',
  waiting: 'bg-yellow-500',
  idle: 'bg-gray-500',
  error: 'bg-red-500'
}

export function TabView() {
  const orderedIds = useVisibleTerminals()
  const terminals = useAppStore((s) => s.terminals)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const setSelected = useAppStore((s) => s.setSelectedTerminal)
  const setFocused = useAppStore((s) => s.setFocusedTerminal)
  const focusedId = useAppStore((s) => s.focusedTerminalId)
  const statusFilter = useAppStore((s) => s.statusFilter)

  const setDialogOpen = useAppStore((s) => s.setNewAgentDialogOpen)

  const isFiltered = statusFilter !== 'all'

  // Auto-select first tab if activeTabId is null or not in orderedIds
  useEffect(() => {
    if (orderedIds.length === 0) {
      if (activeTabId !== null) setActiveTabId(null)
      return
    }
    if (!activeTabId || !orderedIds.includes(activeTabId)) {
      setActiveTabId(orderedIds[0])
    }
  }, [orderedIds, activeTabId, setActiveTabId])

  const handleSelectTab = (id: string): void => {
    setActiveTabId(id)
    setSelected(id)
  }

  const handleDoubleClick = (id: string): void => {
    setFocused(id)
  }

  const handleCloseTab = async (id: string): Promise<void> => {
    const terminal = terminals.get(id)
    const name = terminal ? getDisplayName(terminal.session) : id

    if (focusedId === id) setFocused(null)

    // Auto-select adjacent tab before removing
    if (activeTabId === id) {
      const idx = orderedIds.indexOf(id)
      const nextId = orderedIds[idx + 1] ?? orderedIds[idx - 1] ?? null
      setActiveTabId(nextId)
    }

    await closeTerminalSession(id)
    toast.success(`Session "${name}" closed`)
  }

  if (orderedIds.length === 0) {
    return (
      <div className="h-full overflow-auto p-4">
        {isFiltered ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-white/20 mb-6"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M7 8l3 3-3 3M12 14h4" />
            </svg>
            <p className="text-2xl font-semibold text-white mb-2">No matching agents</p>
            <p className="text-sm text-gray-500 mb-6">Try changing the status filter</p>
          </div>
        ) : (
          <PromptLauncher mode="inline" />
        )}
      </div>
    )
  }

  const activeTerminal = activeTabId ? terminals.get(activeTabId) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div
        className="shrink-0 flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] overflow-x-auto"
        style={{ minHeight: 36 }}
      >
        {orderedIds.map((id) => {
          const terminal = terminals.get(id)
          if (!terminal) return null
          const isActive = id === activeTabId
          const assignedTask = useAppStore
            .getState()
            .config?.tasks?.find((t) => t.assignedSessionId === id && t.status === 'in_progress')
          const displayName = terminal.session.displayName?.trim()
            ? getDisplayName(terminal.session)
            : assignedTask
              ? assignedTask.title
              : getDisplayName(terminal.session)

          return (
            <button
              key={id}
              onClick={() => handleSelectTab(id)}
              onDoubleClick={() => handleDoubleClick(id)}
              className={`group flex items-center gap-1.5 px-2.5 h-[28px] rounded-md text-xs
                         transition-colors shrink-0 max-w-[200px] ${
                           isActive
                             ? 'bg-white/[0.1] text-white'
                             : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                         }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[terminal.status]}`}
              />
              <AgentIcon agentType={terminal.session.agentType} size={12} />
              <span className="truncate">{displayName}</span>
              <ConfirmPopover
                message="Close this session?"
                confirmLabel="Close"
                onConfirm={() => handleCloseTab(id)}
              >
                <span
                  className="ml-1 shrink-0 w-4 h-4 flex items-center justify-center rounded
                             transition-colors opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-200 hover:bg-white/[0.1]"
                  title="Close session"
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M1 1l6 6M7 1l-6 6" />
                  </svg>
                </span>
              </ConfirmPopover>
            </button>
          )
        })}

        {/* New session button */}
        <button
          onClick={() => setDialogOpen(true)}
          className="shrink-0 w-[28px] h-[28px] flex items-center justify-center rounded-md
                     text-gray-500 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
          title="New session"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6 1v10M1 6h10" />
          </svg>
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0" style={{ background: '#141416' }}>
        {activeTabId && activeTerminal && !focusedId && (
          <TerminalInstance key={activeTabId} terminalId={activeTabId} isFocused={true} />
        )}
        {activeTabId && activeTerminal && focusedId === activeTabId && (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            Expanded
          </div>
        )}
        {activeTabId &&
          activeTerminal &&
          activeTerminal.lastOutputTimestamp === 0 &&
          !focusedId && (
            <div
              className="absolute inset-0 p-3 space-y-2 pointer-events-none"
              style={{ background: '#141416' }}
            >
              <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse" />
              <div
                className="h-3 w-1/2 rounded bg-white/[0.04] animate-pulse"
                style={{ animationDelay: '0.15s' }}
              />
              <div
                className="h-3 w-5/6 rounded bg-white/[0.04] animate-pulse"
                style={{ animationDelay: '0.3s' }}
              />
              <div
                className="h-3 w-2/3 rounded bg-white/[0.04] animate-pulse"
                style={{ animationDelay: '0.45s' }}
              />
            </div>
          )}
      </div>
    </div>
  )
}
