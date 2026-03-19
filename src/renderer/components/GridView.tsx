import { memo, useRef, useState, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentCard } from './AgentCard'
import { HeadlessPill } from './HeadlessPill'
import { PromptLauncher } from './PromptLauncher'
import { GridContextMenu } from './GridContextMenu'
import { useVisibleTerminals } from '../hooks/useVisibleTerminals'
import { useIsMobile } from '../hooks/useIsMobile'
import { HeadlessSession } from '../../shared/types'

const EMPTY_HEADLESS: HeadlessSession[] = []

interface DragState {
  draggingId: string
  startX: number
  startY: number
  isDragging: boolean
}

export const GridView = memo(function GridView() {
  const { gridColumns, sortMode, statusFilter, reorderTerminals, rowHeight } = useAppStore(
    useShallow((s) => ({
      gridColumns: s.gridColumns,
      sortMode: s.sortMode,
      statusFilter: s.statusFilter,
      reorderTerminals: s.reorderTerminals,
      rowHeight: s.rowHeight
    }))
  )
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
    if (!showHeadless || headlessSessions.length === 0) return EMPTY_HEADLESS
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

  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [gridContextMenu, setGridContextMenu] = useState<{ x: number; y: number } | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const orderedIds = useVisibleTerminals()

  const isMobile = useIsMobile()

  const isFiltered = statusFilter !== 'all'

  const gridStyle: React.CSSProperties = {
    ...(isMobile
      ? { gridTemplateColumns: '1fr' }
      : gridColumns > 0
        ? { gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }
        : { gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }),
    gridAutoRows: isMobile ? 'auto' : `${rowHeight + 42}px`
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
      {/* Headless agents section */}
      {filteredHeadless.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Headless Agents
            </span>
            <span className="text-[10px] text-gray-600">
              {filteredHeadless.filter((s) => s.status === 'running').length} running
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filteredHeadless.map((session) => (
              <HeadlessPill key={session.id} session={session} />
            ))}
          </div>
          {orderedIds.length > 0 && <div className="h-px bg-white/[0.06] mt-4" />}
        </div>
      )}

      {orderedIds.length === 0 && filteredHeadless.length === 0 ? (
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
      ) : orderedIds.length > 0 ? (
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
                  onDragStart={sortMode === 'manual' ? handleDragStart : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      ) : null}
      {gridContextMenu && (
        <GridContextMenu position={gridContextMenu} onClose={() => setGridContextMenu(null)} />
      )}
    </div>
  )
})

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
