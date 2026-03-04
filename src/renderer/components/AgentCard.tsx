import { useState, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentIcon } from './AgentIcon'
import { StatusBadge } from './StatusBadge'
import { TerminalInstance } from './TerminalInstance'
import { TrafficLights } from './TrafficLights'
import { InlineRename } from './InlineRename'
import { GitChangesIndicator } from './GitChangesIndicator'
import { AGENT_DEFINITIONS } from '../lib/agent-definitions'
import { destroyTerminal } from '../lib/terminal-registry'
import { getDisplayName } from '../lib/terminal-display'
import { GitBranch, FolderGit2, Server } from 'lucide-react'

interface Props {
  terminalId: string
  isDragTarget?: boolean
  onDragStart?: (e: React.PointerEvent) => void
}

function RowResizeHandle() {
  const handlePointerDown = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = useAppStore.getState().rowHeight

    const onMove = (ev: PointerEvent): void => {
      const delta = ev.clientY - startY
      const newHeight = Math.max(100, Math.min(600, startHeight + delta))
      useAppStore.getState().setRowHeight(newHeight)
    }

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="h-1.5 cursor-row-resize bg-transparent hover:bg-white/[0.06] transition-colors shrink-0"
      onPointerDown={handlePointerDown}
    />
  )
}

export const AgentCard = forwardRef<HTMLDivElement, Props>(
  function AgentCard({ terminalId, isDragTarget, onDragStart }, ref) {
    const terminal = useAppStore((s) => s.terminals.get(terminalId))
    const focusedId = useAppStore((s) => s.focusedTerminalId)
    const selectedId = useAppStore((s) => s.selectedTerminalId)
    const setSelected = useAppStore((s) => s.setSelectedTerminal)
    const setFocused = useAppStore((s) => s.setFocusedTerminal)
    const removeTerminal = useAppStore((s) => s.removeTerminal)
    const isMinimized = useAppStore((s) => s.minimizedTerminals.has(terminalId))
    const toggleMinimized = useAppStore((s) => s.toggleMinimized)
    const isRenaming = useAppStore((s) => s.renamingTerminalId === terminalId)
    const setRenamingTerminalId = useAppStore((s) => s.setRenamingTerminalId)
    const renameTerminal = useAppStore((s) => s.renameTerminal)
    const [cardHovered, setCardHovered] = useState(false)

    if (!terminal) return null

    const isFocused = focusedId === terminalId
    const isSelected = selectedId === terminalId
    const def = AGENT_DEFINITIONS[terminal.session.agentType]

    const handleKill = async (): Promise<void> => {
      if (focusedId === terminalId) setFocused(null)
      await window.api.killTerminal(terminalId)
      destroyTerminal(terminalId)
      removeTerminal(terminalId)
    }

    const handleMinimize = (): void => {
      toggleMinimized(terminalId)
    }

    const handleExpand = (): void => {
      setFocused(terminalId)
    }

    return (
      <motion.div
        ref={ref}
        layout
        layoutId={terminalId}
        className={`relative rounded-lg border overflow-hidden flex flex-col
                   transition-colors
                   ${isFocused
                     ? 'border-blue-500/60 ring-1 ring-blue-500/30'
                     : isSelected
                       ? 'border-white/40 ring-1 ring-white/10'
                       : isDragTarget
                         ? 'card-drop-target border-blue-500/30 hover:border-white/[0.12]'
                         : 'border-white/[0.06] hover:border-white/[0.12]'
                   }`}
        style={{ background: 'rgba(0, 0, 0, 0.25)', ...(isMinimized ? { alignSelf: 'start' } : {}) }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onMouseDown={() => { if (!isSelected && !isFocused) setSelected(terminalId) }}
        onMouseEnter={() => setCardHovered(true)}
        onMouseLeave={() => setCardHovered(false)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] shrink-0">
          {/* Drag handle + info — click to expand */}
          <div
            className={`flex-1 min-w-0 flex items-center gap-2 cursor-pointer ${onDragStart ? 'drag-handle' : ''}`}
            onClick={handleExpand}
            onPointerDown={onDragStart}
          >
            <AgentIcon agentType={terminal.session.agentType} size={14} />
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <InlineRename
                  value={getDisplayName(terminal.session)}
                  onCommit={(name) => {
                    renameTerminal(terminalId, name)
                    setRenamingTerminalId(null)
                  }}
                  onCancel={() => setRenamingTerminalId(null)}
                  className="text-[13px] font-medium w-full"
                />
              ) : (
                <div
                  className="text-[13px] font-medium text-gray-300 truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setRenamingTerminalId(terminalId)
                  }}
                >
                  {getDisplayName(terminal.session)}
                </div>
              )}
              {terminal.session.branch && (
                <div className="flex items-center gap-1 mt-0.5">
                  {terminal.session.isWorktree ? (
                    <FolderGit2 size={10} className="text-amber-500 shrink-0" strokeWidth={1.5} />
                  ) : (
                    <GitBranch size={10} className="text-gray-600 shrink-0" strokeWidth={1.5} />
                  )}
                  <span className={`text-[10px] font-mono truncate ${terminal.session.isWorktree ? 'text-amber-400' : 'text-gray-500'}`}>
                    {terminal.session.branch}
                  </span>
                  {terminal.session.isWorktree && (
                    <span className="text-[9px] text-amber-500/60">worktree</span>
                  )}
                </div>
              )}
              {terminal.session.remoteHostLabel && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Server size={10} className="text-blue-400 shrink-0" strokeWidth={1.5} />
                  <span className="text-[10px] font-mono text-blue-400 truncate">
                    {terminal.session.remoteHostLabel}
                  </span>
                  <span className="text-[9px] text-blue-400/60">remote</span>
                </div>
              )}
            </div>
          </div>

          <StatusBadge status={terminal.status} />
          <GitChangesIndicator terminalId={terminalId} />

          {/* Traffic lights — right side */}
          <div className={cardHovered ? '' : 'traffic-light-inactive'}>
            <TrafficLights
              onClose={handleKill}
              onMinimize={handleMinimize}
              onExpand={handleExpand}
            />
          </div>
        </div>

        {/* Terminal — collapsible via minimize */}
        {!isMinimized && (
          <div className="flex-1 min-h-0" style={{ background: 'rgba(0, 0, 0, 0.15)' }}>
            {!isFocused && <TerminalInstance terminalId={terminalId} isFocused={isSelected} />}
            {isFocused && (
              <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                Expanded
              </div>
            )}
          </div>
        )}

        {/* Resize handle */}
        {!isMinimized && <RowResizeHandle />}
      </motion.div>
    )
  }
)
