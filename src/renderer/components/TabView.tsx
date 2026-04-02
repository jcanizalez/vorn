import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useAppStore } from '../stores'
import { getProjectRemoteHostId } from '../../shared/types'
import { useVisibleTerminals } from '../hooks/useVisibleTerminals'
import { AgentIcon } from './AgentIcon'
import { TerminalInstance } from './TerminalInstance'
import { PromptLauncher } from './PromptLauncher'
import { InlineRename } from './InlineRename'
import { CardContextMenu } from './CardContextMenu'
import { BackgroundTray } from './BackgroundTray'
import { TabStatusBar } from './TabStatusBar'
import { getDisplayName, getBranchLabel } from '../lib/terminal-display'
import { closeTerminalSession } from '../lib/terminal-close'
import { resolveActiveProject } from '../lib/session-utils'
import type { AgentStatus } from '../../shared/types'
import { STATUS_DOT } from '../lib/status-colors'
import { ConfirmPopover } from './ConfirmPopover'
import { toast } from './Toast'
import { ChevronDown, GripVertical, Pencil } from 'lucide-react'
import { GridContextMenu } from './GridContextMenu'

const isMac = navigator.platform.toUpperCase().includes('MAC')

const STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  error: 'Error'
}

const DRAG_THRESHOLD = 5

interface DragState {
  draggingId: string
  startX: number
  offsetX: number
  isDragging: boolean
  pointerX: number
  pointerY: number
}

function getHorizontalDropIndex(
  pointerX: number,
  orderedIds: string[],
  refs: Map<string, HTMLElement>
): number | null {
  let closestIndex: number | null = null
  let closestDist = Infinity

  for (let i = 0; i < orderedIds.length; i++) {
    const el = refs.get(orderedIds[i])
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const dist = Math.abs(pointerX - cx)
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = i
    }
  }

  return closestIndex
}

function buildTooltip(
  displayName: string,
  status: AgentStatus,
  branch?: string,
  isWorktree?: boolean,
  taskTitle?: string
): string {
  const lines = [`${displayName} \u2014 ${STATUS_LABEL[status]}`]
  if (branch) {
    lines.push(`Branch: ${branch}${isWorktree ? ' (worktree)' : ''}`)
  }
  if (taskTitle) {
    lines.push(`Task: ${taskTitle}`)
  }
  return lines.join('\n')
}

/* ── Plus-button dropdown (reuses GridContextMenu) ──────────── */

function PlusDropdown({
  position,
  onClose
}: {
  position: { top: number; left: number }
  onClose: () => void
}) {
  return <GridContextMenu position={{ x: position.left, y: position.top }} onClose={onClose} />
}

/* ── TabView ─────────────────────────────────────────────────── */

export function TabView() {
  const { orderedIds, minimizedIds } = useVisibleTerminals()
  const terminals = useAppStore((s) => s.terminals)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const setSelected = useAppStore((s) => s.setSelectedTerminal)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const renamingTerminalId = useAppStore((s) => s.renamingTerminalId)
  const setRenamingTerminalId = useAppStore((s) => s.setRenamingTerminalId)
  const renameTerminal = useAppStore((s) => s.renameTerminal)
  const sortMode = useAppStore((s) => s.sortMode)
  const reorderTerminals = useAppStore((s) => s.reorderTerminals)
  const tasks = useAppStore((s) => s.config?.tasks)
  const headlessSessions = useAppStore((s) => s.headlessSessions)
  const showHeadless = useAppStore((s) => s.config?.defaults?.showHeadlessAgents !== false)
  const activeProject = useAppStore((s) => s.activeProject)
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const projects = useAppStore((s) => s.config?.projects)

  const workspaceProjects = useMemo(() => {
    if (!projects) return null
    return new Set(
      projects.filter((p) => (p.workspaceId ?? 'personal') === activeWorkspace).map((p) => p.name)
    )
  }, [projects, activeWorkspace])

  const filteredHeadless = useMemo(() => {
    if (!showHeadless || headlessSessions.length === 0) return []
    return headlessSessions.filter((s) => {
      if (activeProject && s.projectName !== activeProject) return false
      if (!activeProject && workspaceProjects && !workspaceProjects.has(s.projectName)) return false
      if (statusFilter !== 'all') {
        const mapped = s.status === 'running' ? 'running' : s.exitCode !== 0 ? 'error' : 'idle'
        if (mapped !== statusFilter) return false
      }
      return true
    })
  }, [headlessSessions, showHeadless, activeProject, workspaceProjects, statusFilter])

  const [contextMenu, setContextMenu] = useState<{
    terminalId: string
    x: number
    y: number
  } | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [plusDropdownPos, setPlusDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const isFiltered = statusFilter !== 'all'
  const isManualSort = sortMode === 'manual'

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

  const handleCloseTab = async (id: string): Promise<void> => {
    const terminal = terminals.get(id)
    const name = terminal ? getDisplayName(terminal.session) : id

    const state = useAppStore.getState()
    if (state.focusedTerminalId === id) state.setFocusedTerminal(null)

    // Auto-select adjacent tab before removing
    if (activeTabId === id) {
      const idx = orderedIds.indexOf(id)
      const nextId = orderedIds[idx + 1] ?? orderedIds[idx - 1] ?? null
      setActiveTabId(nextId)
    }

    await closeTerminalSession(id)
    toast.success(`Session "${name}" closed`)
  }

  /* ── Drag handlers ─────────────────────────────────────────── */

  const handleDragStart = useCallback(
    (terminalId: string, e: React.PointerEvent) => {
      if (!isManualSort) return
      if (e.button !== 0) return
      const el = tabRefs.current.get(terminalId)
      const rect = el?.getBoundingClientRect()
      setDragState({
        draggingId: terminalId,
        startX: e.clientX,
        offsetX: rect ? e.clientX - rect.left : 0,
        isDragging: false,
        pointerX: e.clientX,
        pointerY: e.clientY
      })
    },
    [isManualSort]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return
      const dx = e.clientX - dragState.startX
      if (!dragState.isDragging && Math.abs(dx) < DRAG_THRESHOLD) return
      if (!dragState.isDragging) {
        setDragState((prev) =>
          prev ? { ...prev, isDragging: true, pointerX: e.clientX, pointerY: e.clientY } : prev
        )
      } else {
        setDragState((prev) =>
          prev ? { ...prev, pointerX: e.clientX, pointerY: e.clientY } : prev
        )
      }
      const targetIndex = getHorizontalDropIndex(e.clientX, orderedIds, tabRefs.current)
      setDropTargetIndex(targetIndex)
    },
    [dragState, orderedIds]
  )

  const handlePointerUp = useCallback(() => {
    if (dragState?.isDragging && dropTargetIndex !== null) {
      const fromIndex = orderedIds.indexOf(dragState.draggingId)
      if (
        fromIndex !== -1 &&
        fromIndex !== dropTargetIndex &&
        orderedIds.includes(dragState.draggingId)
      ) {
        reorderTerminals(fromIndex, dropTargetIndex)
      }
    }
    setDragState(null)
    setDropTargetIndex(null)
  }, [dragState, dropTargetIndex, orderedIds, reorderTerminals])

  const handlePointerCancel = useCallback(() => {
    setDragState(null)
    setDropTargetIndex(null)
  }, [])

  /* ── Quick launch ──────────────────────────────────────────── */

  const handleQuickLaunch = async (): Promise<void> => {
    const state = useAppStore.getState()
    const project = resolveActiveProject()
    if (!project) {
      state.setNewAgentDialogOpen(true)
      return
    }
    const agentType = state.config?.defaults.defaultAgent || 'claude'
    const remoteHostId = getProjectRemoteHostId(project)
    const session = await window.api.createTerminal({
      agentType,
      projectName: project.name,
      projectPath: project.path,
      remoteHostId
    })
    state.addTerminal(session)
  }

  /* ── Empty state ───────────────────────────────────────────── */

  if (orderedIds.length === 0 && minimizedIds.length === 0) {
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

  const hasBackground = minimizedIds.length > 0 || filteredHeadless.length > 0

  if (orderedIds.length === 0 && hasBackground) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4">
          <BackgroundTray
            headlessSessions={filteredHeadless}
            minimizedIds={minimizedIds}
            variant="grid"
          />
        </div>
      </div>
    )
  }

  const activeTerminal = activeTabId ? terminals.get(activeTabId) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Background tray: headless + minimized */}
      <BackgroundTray
        headlessSessions={filteredHeadless}
        minimizedIds={minimizedIds}
        variant="tabs"
      />

      {/* Tab bar */}
      <div
        className="shrink-0 flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] overflow-x-auto"
        style={{ minHeight: 36 }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {orderedIds.map((id, index) => {
          const terminal = terminals.get(id)
          if (!terminal) return null
          const isActive = id === activeTabId
          const isRenaming = renamingTerminalId === id
          const isDragTarget = dragState?.isDragging === true && dropTargetIndex === index
          const isDragging = dragState?.isDragging === true && dragState.draggingId === id
          const isIdlePinned = terminal.status === 'idle' && terminal.session.pinned === true

          const assignedTask = tasks?.find(
            (t) => t.assignedSessionId === id && t.status === 'in_progress'
          )
          const displayName = terminal.session.displayName?.trim()
            ? getDisplayName(terminal.session)
            : assignedTask
              ? assignedTask.title
              : getDisplayName(terminal.session)

          const tooltipTaskTitle =
            displayName === assignedTask?.title ? undefined : assignedTask?.title
          const tooltip = buildTooltip(
            displayName,
            terminal.status,
            getBranchLabel(terminal.session),
            terminal.session.isWorktree,
            tooltipTaskTitle
          )

          return (
            <div
              key={id}
              role="tab"
              tabIndex={0}
              ref={(el) => {
                if (el) tabRefs.current.set(id, el)
                else tabRefs.current.delete(id)
              }}
              onClick={() => handleSelectTab(id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({ terminalId: id, x: e.clientX, y: e.clientY })
              }}
              title={tooltip}
              className={`group relative flex items-center gap-1.5 px-2.5 h-[28px] rounded-md text-xs
                         transition-colors shrink-0 max-w-[240px] select-none
                         ${isDragTarget ? 'ring-1 ring-blue-500/50' : ''}
                         ${isDragging ? 'opacity-50' : ''}
                         ${
                           isActive
                             ? 'bg-white/[0.1] text-white'
                             : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                         }`}
              style={isIdlePinned ? { opacity: 0.55 } : undefined}
            >
              {/* Drag handle — left edge, only in manual sort */}
              {isManualSort && (
                <span
                  className={`absolute left-0 top-0 bottom-0 w-[14px] flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition-opacity z-10
                             ${isDragging ? 'cursor-grabbing opacity-100' : 'cursor-grab'}`}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    handleDragStart(id, e)
                  }}
                >
                  <GripVertical size={8} className="text-gray-600" strokeWidth={2} />
                </span>
              )}

              <AgentIcon agentType={terminal.session.agentType} size={12} />

              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[terminal.status]}`}
              />

              {isRenaming ? (
                <InlineRename
                  value={getDisplayName(terminal.session)}
                  onCommit={(name) => {
                    renameTerminal(id, name)
                    setRenamingTerminalId(null)
                    toast.success(`Renamed to "${name}"`)
                  }}
                  onCancel={() => setRenamingTerminalId(null)}
                  className="text-xs w-[100px]"
                />
              ) : (
                <>
                  <span className="truncate">{displayName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenamingTerminalId(id)
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity"
                    title="Rename"
                  >
                    <Pencil size={9} />
                  </button>
                </>
              )}

              {/* Keyboard shortcut badge */}
              {index < 9 && !isRenaming && (
                <span
                  className="shrink-0 ml-auto px-0.5 text-[8px] font-mono text-gray-600
                               bg-white/[0.04] border border-white/[0.06] rounded leading-none
                               pointer-events-none"
                >
                  {isMac ? '\u2318' : 'Ctrl+'}
                  {index + 1}
                </span>
              )}

              <ConfirmPopover
                message="Close this session?"
                confirmLabel="Close"
                onConfirm={() => handleCloseTab(id)}
              >
                <span
                  className="ml-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded
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
            </div>
          )
        })}

        {/* Split "+" button: quick launch + dropdown */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={handleQuickLaunch}
            className="h-[28px] w-[24px] flex items-center justify-center rounded-l-md
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
          <button
            onClick={(e) => {
              if (plusDropdownPos) {
                setPlusDropdownPos(null)
              } else {
                const rect = e.currentTarget.getBoundingClientRect()
                const menuWidth = 220
                setPlusDropdownPos({
                  left: Math.max(
                    8,
                    Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
                  ),
                  top: rect.bottom + 4
                })
              }
            }}
            className="h-[28px] w-[16px] flex items-center justify-center rounded-r-md
                       text-gray-500 hover:text-gray-200 hover:bg-white/[0.06] transition-colors
                       border-l border-white/[0.06]"
            title="More launch options"
          >
            <ChevronDown size={10} strokeWidth={2} />
          </button>
        </div>

        {plusDropdownPos && (
          <PlusDropdown position={plusDropdownPos} onClose={() => setPlusDropdownPos(null)} />
        )}
      </div>

      {/* Terminal content */}
      <div className="relative flex-1 min-h-0" style={{ background: '#141416' }}>
        {activeTabId && activeTerminal && (
          <TerminalInstance key={activeTabId} terminalId={activeTabId} isFocused={true} />
        )}
        {activeTabId && activeTerminal && activeTerminal.lastOutputTimestamp === 0 && (
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

      {/* Status bar */}
      {activeTabId && activeTerminal && <TabStatusBar terminalId={activeTabId} />}

      {/* Context menu */}
      {contextMenu && (
        <CardContextMenu
          terminalId={contextMenu.terminalId}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {dragState?.isDragging &&
        (() => {
          const terminal = terminals.get(dragState.draggingId)
          if (!terminal) return null
          const displayName = getDisplayName(terminal.session)
          return createPortal(
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 0.9, scale: 1 }}
              className="fixed flex items-center gap-1.5 px-2.5 h-[28px] rounded-md text-xs
                       bg-white/[0.1] text-white border border-white/[0.12] pointer-events-none"
              style={{
                left: dragState.pointerX - dragState.offsetX,
                top: dragState.pointerY - 14,
                zIndex: 9999,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[terminal.status]}`}
              />
              <AgentIcon agentType={terminal.session.agentType} size={12} />
              <span className="truncate max-w-[160px]">{displayName}</span>
            </motion.div>,
            document.body
          )
        })()}
    </div>
  )
}
