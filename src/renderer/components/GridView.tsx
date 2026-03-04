import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentCard } from './AgentCard'
import { RecentSessionsCard } from './RecentSessionsCard'

interface DragState {
  draggingId: string
  startX: number
  startY: number
  isDragging: boolean
}

export function GridView() {
  const terminals = useAppStore((s) => s.terminals)
  const activeProject = useAppStore((s) => s.activeProject)
  const setDialogOpen = useAppStore((s) => s.setNewAgentDialogOpen)
  const gridColumns = useAppStore((s) => s.gridColumns)
  const sortMode = useAppStore((s) => s.sortMode)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const terminalOrder = useAppStore((s) => s.terminalOrder)
  const reorderTerminals = useAppStore((s) => s.reorderTerminals)
  const setVisibleTerminalIds = useAppStore((s) => s.setVisibleTerminalIds)

  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Filter by project + status, then sort
  const orderedIds = useMemo(() =>
    Array.from(terminals.entries())
      .filter(([, t]) => {
        if (activeProject && t.session.projectName !== activeProject) return false
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        return true
      })
      .sort(([aId, aState], [bId, bState]) => {
        switch (sortMode) {
          case 'created':
            return bState.session.createdAt - aState.session.createdAt
          case 'recent':
            return bState.lastOutputTimestamp - aState.lastOutputTimestamp
          case 'manual':
          default: {
            const ia = terminalOrder.indexOf(aId)
            const ib = terminalOrder.indexOf(bId)
            return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
          }
        }
      })
      .map(([id]) => id),
    [terminals, activeProject, statusFilter, sortMode, terminalOrder]
  )

  useEffect(() => {
    setVisibleTerminalIds(orderedIds)
    // Clear stale selection if the selected card is no longer visible
    const sel = useAppStore.getState().selectedTerminalId
    if (sel && !orderedIds.includes(sel)) {
      useAppStore.getState().setSelectedTerminal(null)
    }
  }, [orderedIds, setVisibleTerminalIds])

  const rowHeight = useAppStore((s) => s.rowHeight)

  const isFiltered = statusFilter !== 'all'

  const gridStyle: React.CSSProperties = {
    ...(gridColumns > 0
      ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
      : { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }),
    gridAutoRows: `${rowHeight + 42}px`
  }

  const DRAG_THRESHOLD = 5

  const handleDragStart = useCallback((terminalId: string, e: React.PointerEvent) => {
    if (sortMode !== 'manual') return
    if (e.button !== 0) return
    setDragState({
      draggingId: terminalId,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false
    })
  }, [sortMode])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return

    const dx = e.clientX - dragState.startX
    const dy = e.clientY - dragState.startY

    if (!dragState.isDragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return

    if (!dragState.isDragging) {
      setDragState({ ...dragState, isDragging: true })
    }

    const targetIndex = getDropIndex(e.clientX, e.clientY, orderedIds, cardRefs.current)
    setDropTargetIndex(targetIndex)
  }, [dragState, orderedIds])

  const handlePointerUp = useCallback(() => {
    if (dragState?.isDragging && dropTargetIndex !== null) {
      const fromIndex = orderedIds.indexOf(dragState.draggingId)
      if (fromIndex !== -1 && fromIndex !== dropTargetIndex) {
        reorderTerminals(fromIndex, dropTargetIndex)
      }
    }
    setDragState(null)
    setDropTargetIndex(null)
  }, [dragState, dropTargetIndex, orderedIds, reorderTerminals])

  return (
    <div
      className="h-full overflow-auto p-4"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {orderedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full">
          {isFiltered ? (
            <>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1" className="text-white/20 mb-6">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <path d="M7 8l3 3-3 3M12 14h4" />
              </svg>
              <p className="text-2xl font-semibold text-white mb-2">No matching agents</p>
              <p className="text-sm text-gray-500 mb-6">Try changing the status filter</p>
            </>
          ) : (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1" className="text-white/20 mb-4">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <path d="M7 8l3 3-3 3M12 14h4" />
              </svg>
              <p className="text-xl font-semibold text-white mb-1">No agents running</p>
              <p className="text-sm text-gray-500 mb-5">Resume a previous session or start a new one</p>
              <div className="w-full max-w-[560px] mb-5" style={{ height: `${rowHeight + 42}px` }}>
                <RecentSessionsCard />
              </div>
              <button
                onClick={() => setDialogOpen(true)}
                className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white
                           rounded-lg transition-colors text-sm font-medium"
              >
                New Session (Cmd+N)
              </button>
            </>
          )}
        </div>
      ) : (
        <LayoutGroup>
          <div className="grid gap-4" style={gridStyle}>
            <AnimatePresence>
              {orderedIds.map((id, index) => (
                <AgentCard
                  key={id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(id, el)
                    else cardRefs.current.delete(id)
                  }}
                  terminalId={id}
                  isDragTarget={
                    dragState?.isDragging === true && dropTargetIndex === index
                  }
                  onDragStart={sortMode === 'manual' ? (e) => handleDragStart(id, e) : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      )}
    </div>
  )
}

function getDropIndex(
  pointerX: number,
  pointerY: number,
  orderedIds: string[],
  refs: Map<string, HTMLDivElement>
): number | null {
  let closestIndex: number | null = null
  let closestDist = Infinity

  for (let i = 0; i < orderedIds.length; i++) {
    const el = refs.get(orderedIds[i])
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dist = Math.hypot(pointerX - cx, pointerY - cy)
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = i
    }
  }

  return closestIndex
}
