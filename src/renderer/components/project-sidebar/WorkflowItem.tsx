import type { WorkflowDefinition } from '../../../shared/types'
import { ICON_MAP } from './icon-map'
import { WorkflowContextMenu } from './WorkflowContextMenu'
import { useAppStore } from '../../stores'
import { isScheduledWorkflow } from '../../lib/workflow-helpers'
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
  const updateWorkflow = useAppStore((s) => s.updateWorkflow)

  const wf = workflow
  const WfIcon = ICON_MAP[wf.icon] || Zap
  const isScheduled = isScheduledWorkflow(wf)
  const isDisabled = isScheduled && !wf.enabled

  const handleEdit = () => {
    setEditingWorkflowId(wf.id)
    setWorkflowEditorOpen(true)
  }

  return (
    <div className={`group relative flex items-center ${isDisabled ? 'opacity-40' : ''}`}>
      <button
        onClick={handleEdit}
        className={`flex-1 text-left px-2.5 py-1.5 rounded-md text-[13px] transition-colors
                   flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/[0.04]
                   min-w-0 ${isCollapsed ? 'justify-center px-0' : ''}`}
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
        {!isCollapsed && <span className="truncate">{wf.name}</span>}
      </button>
      {!isCollapsed && (
        <div className="flex items-center shrink-0">
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
                onEdit={handleEdit}
                onDelete={() => removeWorkflow(wf.id)}
                onChangeIcon={(icon, color) => {
                  updateWorkflow(wf.id, { ...wf, icon, iconColor: color })
                }}
                isScheduled={isScheduled}
                isEnabled={wf.enabled}
                currentIcon={wf.icon}
                currentColor={wf.iconColor || '#3b82f6'}
                onToggleEnabled={() => {
                  updateWorkflow(wf.id, { ...wf, enabled: !wf.enabled })
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
