import { WorkflowDefinition } from '../../../shared/types'
import { ICON_MAP } from './icon-map'
import { WorkflowContextMenu } from './WorkflowContextMenu'
import { useAppStore } from '../../stores'
import { getActionCount, isScheduledWorkflow, getTriggerLabel } from '../../lib/workflow-helpers'
import { executeWorkflow } from '../../lib/workflow-execution'
import { Clock, Zap, Play, MoreHorizontal } from 'lucide-react'

export function WorkflowItem({
  workflow,
  isCollapsed,
  iconSize,
  openMenuId,
  setOpenMenuId
}: {
  workflow: WorkflowDefinition
  isCollapsed: boolean
  iconSize: number
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
}) {
  const setEditingWorkflowId = useAppStore((s) => s.setEditingWorkflowId)
  const setWorkflowEditorOpen = useAppStore((s) => s.setWorkflowEditorOpen)
  const removeWorkflow = useAppStore((s) => s.removeWorkflow)

  const wf = workflow
  const WfIcon = ICON_MAP[wf.icon] || Zap
  const isScheduled = isScheduledWorkflow(wf)
  const isDisabled = isScheduled && !wf.enabled
  const scheduleLabel = getTriggerLabel(wf)
  const actionCount = getActionCount(wf)

  return (
    <div className={`group relative flex items-center ${isDisabled ? 'opacity-40' : ''}`}>
      <button
        onClick={() => {
          setEditingWorkflowId(wf.id)
          setWorkflowEditorOpen(true)
        }}
        className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors
                   flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/[0.04]
                   ${isCollapsed ? 'justify-center px-0' : ''}`}
        title={isCollapsed ? wf.name : undefined}
      >
        <span className="relative shrink-0">
          <WfIcon size={iconSize} color={wf.iconColor || '#6b7280'} strokeWidth={1.5} />
          {isScheduled && !isCollapsed && (
            <Clock
              size={7}
              className="absolute -top-1 -right-1.5 text-blue-400"
              strokeWidth={2.5}
            />
          )}
        </span>
        {!isCollapsed && (
          <>
            <span className="truncate">{wf.name}</span>
            <span className="text-gray-600 text-[10px] ml-auto shrink-0">
              {scheduleLabel || actionCount}
            </span>
          </>
        )}
      </button>
      {!isCollapsed && (
        <div className="flex items-center">
          {!isScheduled && (
            <button
              onClick={() => executeWorkflow(wf)}
              className="opacity-0 group-hover:opacity-100 text-green-500 hover:text-green-400
                         p-1 transition-all shrink-0"
              title="Run workflow"
            >
              <Play size={11} strokeWidth={2.5} />
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setOpenMenuId(openMenuId === wf.id ? null : wf.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-white
                       p-1 transition-all shrink-0"
            >
              <MoreHorizontal size={12} strokeWidth={2} />
            </button>
            {openMenuId === wf.id && (
              <WorkflowContextMenu
                onEdit={() => {
                  setEditingWorkflowId(wf.id)
                  setWorkflowEditorOpen(true)
                }}
                onDelete={() => removeWorkflow(wf.id)}
                isScheduled={isScheduled}
                isEnabled={wf.enabled}
                onToggleEnabled={() => {
                  useAppStore.getState().updateWorkflow(wf.id, { ...wf, enabled: !wf.enabled })
                }}
                onClose={() => setOpenMenuId(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
