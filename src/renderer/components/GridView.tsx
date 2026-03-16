import { useRef, useState, useCallback } from 'react'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentCard } from './AgentCard'
import { PromptLauncher } from './PromptLauncher'
import { GridContextMenu } from './GridContextMenu'
import { useVisibleTerminals } from '../hooks/useVisibleTerminals'

interface DragState {
  draggingId: string
  startX: number
  startY: number
  isDragging: boolean
}

export function GridView() {
  const gridColumns = useAppStore((s) => s.gridColumns)
  const sortMode = useAppStore((s) => s.sortMode)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const reorderTerminals = useAppStore((s) => s.reorderTerminals)

  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [gridContextMenu, setGridContextMenu] = useState<{ x: number; y: number } | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const orderedIds = useVisibleTerminals()

  const rowHeight = useAppStore((s) => s.rowHeight)

  const isFiltered = statusFilter !== 'all'

  const gridStyle: React.CSSProperties = {
    ...(gridColumns > 0
      ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
      : { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }),
    gridAutoRows: `${rowHeight + 42}px`
  }

  const DRAG_THRESHOLD = 5

  const handleDragStart = useCallback(
    (terminalId: string, e: React.PointerEvent) => {
      if (sortMode !== 'manual') return
      if (e.button !== 0) return
      setDragState({
        draggingId: terminalId,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false
      })
    },
    [sortMode]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return

      const dx = e.clientX - dragState.startX
      const dy = e.clientY - dragState.startY

      if (!dragState.isDragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return

      if (!dragState.isDragging) {
        setDragState({ ...dragState, isDragging: true })
      }

      const targetIndex = getDropIndex(e.clientX, e.clientY, orderedIds, cardRefs.current)
      setDropTargetIndex(targetIndex)
    },
    [dragState, orderedIds]
  )

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

  const handleGridDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    const state = useAppStore.getState()
    const activeProjectName = state.activeProject
    const ws = state.activeWorkspace
    const project = activeProjectName
      ? state.config?.projects.find((p) => p.name === activeProjectName)
      : state.config?.projects.find((p) => (p.workspaceId ?? 'personal') === ws)
    if (!project) {
      state.setNewAgentDialogOpen(true)
      return
    }
    const agentType = state.config?.defaults.defaultAgent || 'claude'
    window.api
      .createTerminal({ agentType, projectName: project.name, projectPath: project.path })
      .then((session) => state.addTerminal(session))
  }, [])

  const handleGridContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    setGridContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div
      className="h-full overflow-auto p-4"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDoubleClick={handleGridDoubleClick}
      onContextMenu={handleGridContextMenu}
    >
      {orderedIds.length === 0 ? (
        isFiltered ? (
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
        )
      ) : (
        <LayoutGroup>
          <div
            className="grid gap-4"
            style={gridStyle}
            onDoubleClick={handleGridDoubleClick}
            onContextMenu={handleGridContextMenu}
          >
            <AnimatePresence>
              {orderedIds.map((id, index) => (
                <AgentCard
                  key={id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(id, el)
                    else cardRefs.current.delete(id)
                  }}
                  terminalId={id}
                  index={index}
                  isDragTarget={dragState?.isDragging === true && dropTargetIndex === index}
                  onDragStart={sortMode === 'manual' ? (e) => handleDragStart(id, e) : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      )}
      {gridContextMenu && (
        <GridContextMenu position={gridContextMenu} onClose={() => setGridContextMenu(null)} />
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
