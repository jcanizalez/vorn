import { useState, memo, forwardRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../stores'
import { AgentStatusIcon } from './AgentStatusIcon'
import { TerminalSlot } from './TerminalSlot'
import { InlineRename } from './InlineRename'
import { GitChangesIndicator, BrowseFilesButton } from './GitChangesIndicator'
import { closeTerminalSession } from '../lib/terminal-close'
import { getDisplayName, getBranchLabel } from '../lib/terminal-display'
import { CardContextMenu } from './CardContextMenu'
import { useTerminalScrollButton } from '../hooks/useTerminalScrollButton'
import {
  GitBranch,
  FolderGit2,
  Pencil,
  ListTodo,
  Pin,
  Archive,
  Maximize2,
  Minus,
  X
} from 'lucide-react'
import { toast } from './Toast'
import { Tooltip } from './Tooltip'
import { ConfirmPopover } from './ConfirmPopover'
import { isMac, MOD } from '../lib/platform'

// On touch devices, always show action buttons (no hover available)
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

interface Props {
  terminalId: string
  index?: number
  isDragTarget?: boolean
  onDragStart?: (terminalId: string, e: React.PointerEvent) => void
  flexible?: boolean
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

export const AgentCard = memo(
  forwardRef<HTMLDivElement, Props>(function AgentCard(
    { terminalId, index, isDragTarget, onDragStart, flexible },
    ref
  ) {
    const {
      terminal,
      focusedId,
      selectedId,
      setSelected,
      setFocused,
      toggleMinimized,
      isRenaming,
      setRenamingTerminalId,
      renameTerminal,
      assignedTask,
      setEditingTask,
      setTaskDialogOpen,
      togglePinned,
      archiveSession
    } = useAppStore(
      useShallow((s) => ({
        terminal: s.terminals.get(terminalId),
        focusedId: s.focusedTerminalId,
        selectedId: s.selectedTerminalId,
        setSelected: s.setSelectedTerminal,
        setFocused: s.setFocusedTerminal,
        toggleMinimized: s.toggleMinimized,
        isRenaming: s.renamingTerminalId === terminalId,
        setRenamingTerminalId: s.setRenamingTerminalId,
        renameTerminal: s.renameTerminal,
        assignedTask: s.config?.tasks?.find(
          (t) => t.assignedSessionId === terminalId && t.status === 'in_progress'
        ),
        setEditingTask: s.setEditingTask,
        setTaskDialogOpen: s.setTaskDialogOpen,
        togglePinned: s.togglePinned,
        archiveSession: s.archiveSession
      }))
    )
    const [cardHovered, setCardHovered] = useState(isTouchDevice)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
    const { showScrollBtn, handleScrollToBottom } = useTerminalScrollButton(terminalId)

    if (!terminal) return null

    const isFocused = focusedId === terminalId
    const isSelected = selectedId === terminalId
    const isPinned = terminal.session.pinned === true
    const isIdlePinned = terminal.status === 'idle' && isPinned
    const handleKill = async (): Promise<void> => {
      const name = getDisplayName(terminal.session)
      if (focusedId === terminalId) setFocused(null)
      await closeTerminalSession(terminalId)
      toast.success(`Session "${name}" closed`)
    }

    const handleMinimize = (): void => {
      toggleMinimized(terminalId)
    }

    const handleExpand = (): void => {
      setFocused(terminalId)
    }

    return (
      <div
        ref={ref}
        className={`relative rounded-lg border overflow-hidden flex flex-col
                   transition-colors
                   ${flexible ? 'h-full' : ''}
                   ${
                     isFocused
                       ? 'border-blue-500/60 ring-1 ring-blue-500/30'
                       : isSelected
                         ? 'border-white/40 ring-1 ring-white/10'
                         : isDragTarget
                           ? 'card-drop-target border-blue-500/30 hover:border-white/[0.12]'
                           : 'border-white/[0.06] hover:border-white/[0.12]'
                   }`}
        style={{
          background: '#1a1a1e',
          ...(isIdlePinned ? { opacity: 0.55 } : {})
        }}
        onPointerDown={() => {
          if (!isSelected && !isFocused) setSelected(terminalId)
        }}
        onMouseEnter={() => setCardHovered(true)}
        onMouseLeave={() => !isTouchDevice && setCardHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] shrink-0">
          {/* Drag handle + info — double-click to expand */}
          <div
            className={`flex-1 min-w-0 flex items-center gap-2 cursor-text ${onDragStart || flexible ? 'drag-handle' : ''}`}
            onDoubleClick={handleExpand}
            onPointerDown={onDragStart ? (e) => onDragStart(terminalId, e) : undefined}
          >
            <AgentStatusIcon
              agentType={terminal.session.agentType}
              status={terminal.status}
              size={20}
            />
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <InlineRename
                  value={getDisplayName(terminal.session)}
                  onCommit={(name) => {
                    renameTerminal(terminalId, name)
                    setRenamingTerminalId(null)
                    toast.success(`Renamed to "${name}"`)
                  }}
                  onCancel={() => setRenamingTerminalId(null)}
                  className="text-[13px] font-medium w-full"
                />
              ) : (
                <div className="flex items-center gap-1 group/rename">
                  <span
                    className="text-[13px] font-medium text-gray-300 truncate"
                    title={
                      terminal.session.displayName?.trim()
                        ? getDisplayName(terminal.session)
                        : assignedTask
                          ? assignedTask.title
                          : getDisplayName(terminal.session)
                    }
                  >
                    {terminal.session.displayName?.trim()
                      ? getDisplayName(terminal.session)
                      : assignedTask
                        ? assignedTask.title
                        : getDisplayName(terminal.session)}
                  </span>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenamingTerminalId(terminalId)
                    }}
                    className="opacity-0 group-hover/rename:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity shrink-0"
                    title="Rename"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
              )}
              {terminal.session.branch && (
                <div className="flex items-center gap-1 mt-0.5">
                  {terminal.session.isWorktree ? (
                    <FolderGit2 size={10} className="text-amber-500 shrink-0" strokeWidth={1.5} />
                  ) : (
                    <GitBranch size={10} className="text-gray-600 shrink-0" strokeWidth={1.5} />
                  )}
                  <span
                    className={`text-[10px] font-mono truncate ${terminal.session.isWorktree ? 'text-amber-400' : 'text-gray-500'}`}
                  >
                    {getBranchLabel(terminal.session)}
                  </span>
                  {terminal.session.isWorktree && (
                    <>
                      <GitBranch size={9} className="text-gray-600 shrink-0" strokeWidth={1.5} />
                      <span className="text-[9px] font-mono text-gray-500 truncate">
                        {terminal.session.branch}
                      </span>
                    </>
                  )}
                </div>
              )}
              {assignedTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingTask(assignedTask)
                    setTaskDialogOpen(true)
                  }}
                  className="flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full
                             bg-violet-500/10 hover:bg-violet-500/20 transition-colors group/task"
                >
                  <ListTodo size={10} className="text-violet-400 shrink-0" strokeWidth={2} />
                  <span className="text-[10px] text-violet-400 group-hover/task:text-violet-300 truncate max-w-[120px]">
                    {assignedTask.title}
                  </span>
                </button>
              )}
            </div>
          </div>

          {typeof index === 'number' && index < 9 && (
            <span
              className="px-1 py-0.5 text-[9px] font-mono text-gray-600
                         bg-white/[0.04] border border-white/[0.06] rounded
                         leading-none shrink-0"
            >
              {isMac ? '\u2318' : 'Ctrl+'}
              {index + 1}
            </span>
          )}

          {/* Pin + Browse — appear on hover, left of git */}
          {cardHovered && (
            <div className="flex items-center gap-0.5">
              <Tooltip label={isPinned ? 'Unpin session' : 'Pin session'} position="top">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePinned(terminalId)
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    isPinned
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  aria-label={isPinned ? 'Unpin session' : 'Pin session'}
                >
                  <Pin size={12} strokeWidth={2} className={isPinned ? 'fill-current' : ''} />
                </button>
              </Tooltip>
              {isIdlePinned && (
                <Tooltip label="Archive session" position="top">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      archiveSession(terminalId)
                    }}
                    className="p-1.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label="Archive session"
                  >
                    <Archive size={12} strokeWidth={2} />
                  </button>
                </Tooltip>
              )}
              <BrowseFilesButton terminalId={terminalId} />
            </div>
          )}
          {!cardHovered && isPinned && (
            <Pin size={10} strokeWidth={2} className="text-amber-400 fill-current shrink-0" />
          )}

          <GitChangesIndicator terminalId={terminalId} />

          {/* Expand + Minimize + Close — appear on hover, right of git */}
          {cardHovered && (
            <div className="flex items-center gap-0.5">
              <Tooltip label="Expand" shortcut={`${MOD}O`} position="top">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExpand()
                  }}
                  className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                  aria-label="Expand session"
                >
                  <Maximize2 size={12} strokeWidth={2} />
                </button>
              </Tooltip>
              <Tooltip label="Minimize" position="top">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMinimize()
                  }}
                  className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors"
                  aria-label="Minimize session"
                >
                  <Minus size={12} strokeWidth={2} />
                </button>
              </Tooltip>
              <ConfirmPopover
                message="Close this session?"
                confirmLabel="Close"
                onConfirm={handleKill}
              >
                <Tooltip label="Close session" position="top">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/[0.08] transition-colors"
                    aria-label="Close session"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </Tooltip>
              </ConfirmPopover>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div className="relative flex-1 min-h-0" style={{ background: '#141416' }}>
          {!isFocused && (
            // In flexible mode, reserve 16px at SE so the react-grid-layout
            // resize handle isn't covered by the TerminalHost overlay (z-45).
            <TerminalSlot
              terminalId={terminalId}
              isFocused={isSelected}
              className={flexible ? 'absolute inset-0 right-4 bottom-4' : 'w-full h-full'}
            />
          )}
          {isFocused && (
            <div className="flex items-center justify-center h-full text-gray-600 text-xs">
              Expanded
            </div>
          )}
          {!isFocused && terminal.lastOutputTimestamp === 0 && (
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
          {!isFocused && showScrollBtn && (
            <button
              className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center
                           rounded bg-white/[0.08] hover:bg-white/[0.15] active:bg-white/[0.2]
                           text-gray-400 hover:text-white transition-colors z-50"
              onClick={handleScrollToBottom}
              title="Scroll to bottom"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 2.5V9.5M3 7L6 10L9 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Resize handle */}
        {!flexible && <RowResizeHandle />}

        {/* Context menu */}
        {contextMenu && (
          <CardContextMenu
            terminalId={terminalId}
            position={contextMenu}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    )
  })
)
