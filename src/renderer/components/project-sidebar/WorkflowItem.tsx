import { useRef } from 'react'
import type { WorkflowDefinition } from '../../../shared/types'
import { ICON_MAP } from './icon-map'
import { useAppStore } from '../../stores'
import { isScheduledWorkflow } from '../../lib/workflow-helpers'
import { executeWorkflow } from '../../lib/workflow-execution'
import { Zap, Play, MoreHorizontal } from 'lucide-react'
import { Tooltip } from '../Tooltip'

type DotColor = 'blue' | 'gray' | 'red' | null

function statusDotColor(workflow: WorkflowDefinition, scheduled: boolean): DotColor {
  if (scheduled) return workflow.enabled ? 'blue' : 'gray'
  if (workflow.lastRunStatus === 'error') return 'red'
  return null
}

const DOT_CLASSES: Record<Exclude<DotColor, null>, string> = {
  blue: 'bg-blue-400',
  gray: 'bg-gray-600',
  red: 'bg-red-500'
}

export function WorkflowItem({
  workflow,
  isCollapsed,
  iconSize,
  onContextMenu
}: {
  workflow: WorkflowDefinition
  isCollapsed: boolean
  iconSize: number
  onContextMenu: (e: React.MouseEvent, workflowId: string) => void
}) {
  const setEditingWorkflowId = useAppStore((s) => s.setEditingWorkflowId)
  const setWorkflowEditorOpen = useAppStore((s) => s.setWorkflowEditorOpen)
  const moreRef = useRef<HTMLButtonElement>(null)

  const WfIcon = ICON_MAP[workflow.icon] || Zap
  const isScheduled = isScheduledWorkflow(workflow)
  const isDisabled = isScheduled && !workflow.enabled
  const dot = statusDotColor(workflow, isScheduled)

  const handleEdit = () => {
    setEditingWorkflowId(workflow.id)
    setWorkflowEditorOpen(true)
  }

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (moreRef.current) {
      const rect = moreRef.current.getBoundingClientRect()
      const syntheticEvent = {
        ...e,
        clientX: rect.right,
        clientY: rect.bottom
      } as React.MouseEvent
      onContextMenu(syntheticEvent, workflow.id)
    }
  }

  return (
    <button
      onClick={handleEdit}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, workflow.id)
      }}
      title={isCollapsed ? workflow.name : undefined}
      className={`group/wf w-full text-left px-2 py-1.5 rounded-md text-[13px] flex items-center gap-2 min-w-0 transition-colors text-gray-300 hover:text-white hover:bg-white/[0.04] ${
        isDisabled ? 'opacity-40' : ''
      } ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <span className="relative shrink-0">
        <WfIcon size={iconSize} color={workflow.iconColor || '#6b7280'} strokeWidth={1.5} />
        {dot && !isCollapsed && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#1a1a2e] ${DOT_CLASSES[dot]}`}
            aria-hidden="true"
          />
        )}
      </span>
      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{workflow.name}</span>
          <Tooltip label="Run" position="top">
            <button
              type="button"
              aria-label={`Run workflow ${workflow.name}`}
              onClick={(e) => {
                e.stopPropagation()
                executeWorkflow(workflow)
              }}
              className="opacity-0 group-hover/wf:opacity-100 focus:opacity-100 text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors shrink-0"
            >
              <Play size={11} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip label="More" position="top">
            <button
              ref={moreRef}
              type="button"
              aria-label={`More options for ${workflow.name}`}
              onClick={handleMoreClick}
              className="opacity-0 group-hover/wf:opacity-100 focus:opacity-100 text-gray-500 hover:text-white p-0.5 rounded hover:bg-white/[0.08] transition-colors shrink-0"
            >
              <MoreHorizontal size={12} strokeWidth={2} />
            </button>
          </Tooltip>
        </>
      )}
    </button>
  )
}
