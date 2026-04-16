import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { WorkflowItem } from './WorkflowItem'
import { WorkflowFilterToolbar } from './WorkflowFilterToolbar'
import { WorkflowContextMenu } from './WorkflowContextMenu'
import { isScheduledWorkflow } from '../../lib/workflow-helpers'
import { ChevronRight, Zap } from 'lucide-react'
import type { WorkflowDefinition } from '../../../shared/types'

type ContextMenuState = { id: string; x: number; y: number } | null

export function WorkflowsSection({
  isCollapsed,
  workspaceWorkflows
}: {
  isCollapsed: boolean
  workspaceWorkflows: WorkflowDefinition[]
}) {
  const setWorkflowEditorOpen = useAppStore((s) => s.setWorkflowEditorOpen)
  const setEditingWorkflowId = useAppStore((s) => s.setEditingWorkflowId)
  const removeWorkflow = useAppStore((s) => s.removeWorkflow)
  const updateWorkflow = useAppStore((s) => s.updateWorkflow)
  const reorderWorkflows = useAppStore((s) => s.reorderWorkflows)
  const workflowFilter = useAppStore((s) => s.sidebarWorkflowFilter)

  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)

  const iconSize = isCollapsed ? 22 : 14

  const filteredWorkflows = useMemo(() => {
    if (workflowFilter === 'all') return workspaceWorkflows
    if (workflowFilter === 'manual')
      return workspaceWorkflows.filter((w) => !isScheduledWorkflow(w))
    return workspaceWorkflows.filter((w) => isScheduledWorkflow(w))
  }, [workspaceWorkflows, workflowFilter])

  const handleContextMenu = (e: React.MouseEvent, workflowId: string) => {
    setContextMenu({ id: workflowId, x: e.clientX, y: e.clientY })
  }

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragSourceIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault()
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        reorderWorkflows(fromIndex, toIndex)
      }
      setDragSourceIndex(null)
      setDragOverIndex(null)
    },
    [reorderWorkflows]
  )

  const handleDragEnd = useCallback(() => {
    setDragSourceIndex(null)
    setDragOverIndex(null)
  }, [])

  const menuWorkflow = contextMenu ? workspaceWorkflows.find((w) => w.id === contextMenu.id) : null
  const menuIsScheduled = menuWorkflow ? isScheduledWorkflow(menuWorkflow) : false

  return (
    <>
      {!isCollapsed && (
        <div className="group/section pt-3 pb-1.5 flex items-center justify-between">
          <button
            onClick={() => setSectionCollapsed(!sectionCollapsed)}
            className="flex items-center gap-1.5 hover:text-gray-300 transition-colors"
          >
            <ChevronRight
              size={10}
              strokeWidth={2}
              className={`text-gray-600 transition-transform ${sectionCollapsed ? '' : 'rotate-90'}`}
            />
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Workflows
            </span>
          </button>
          <div className="flex items-center gap-0.5">
            <WorkflowFilterToolbar />
            <Tooltip label="New workflow" position="bottom">
              <button
                onClick={() => {
                  setEditingWorkflowId(null)
                  setWorkflowEditorOpen(true)
                }}
                className="p-0.5 rounded text-gray-600 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <Zap size={13} strokeWidth={1.5} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      {!isCollapsed && !sectionCollapsed && filteredWorkflows.length === 0 && (
        <p className="text-[13px] text-gray-600 px-2.5 py-1">No workflows</p>
      )}

      {!isCollapsed &&
        !sectionCollapsed &&
        filteredWorkflows.map((wf, index) => (
          <div
            key={wf.id}
            draggable={!isCollapsed}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`cursor-grab active:cursor-grabbing ${
              dragOverIndex === index && dragSourceIndex !== index ? 'border-t border-blue-500' : ''
            }`}
          >
            <WorkflowItem
              workflow={wf}
              isCollapsed={isCollapsed}
              iconSize={iconSize}
              onContextMenu={handleContextMenu}
            />
          </div>
        ))}

      {isCollapsed &&
        filteredWorkflows.map((wf) => (
          <WorkflowItem
            key={wf.id}
            workflow={wf}
            isCollapsed={isCollapsed}
            iconSize={iconSize}
            onContextMenu={handleContextMenu}
          />
        ))}

      {contextMenu && menuWorkflow && (
        <WorkflowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isScheduled={menuIsScheduled}
          isEnabled={menuWorkflow.enabled}
          onEdit={() => {
            setEditingWorkflowId(menuWorkflow.id)
            setWorkflowEditorOpen(true)
          }}
          onDelete={() => removeWorkflow(menuWorkflow.id)}
          onToggleEnabled={
            menuIsScheduled
              ? () =>
                  updateWorkflow(menuWorkflow.id, {
                    ...menuWorkflow,
                    enabled: !menuWorkflow.enabled
                  })
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
