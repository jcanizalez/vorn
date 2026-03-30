import { useState, useMemo } from 'react'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { WorkflowItem } from './WorkflowItem'
import { WorkflowSubGroup } from './WorkflowSubGroup'
import { isScheduledWorkflow } from '../../lib/workflow-helpers'
import { ChevronRight, Zap, Calendar } from 'lucide-react'
import type { WorkflowDefinition } from '../../../shared/types'

export function WorkflowsSection({
  isCollapsed,
  workspaceWorkflows
}: {
  isCollapsed: boolean
  workspaceWorkflows: WorkflowDefinition[]
}) {
  const setWorkflowEditorOpen = useAppStore((s) => s.setWorkflowEditorOpen)
  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const iconSize = isCollapsed ? 22 : 14

  const manualWorkflows = useMemo(
    () => workspaceWorkflows.filter((w) => !isScheduledWorkflow(w)),
    [workspaceWorkflows]
  )
  const scheduledWorkflows = useMemo(
    () => workspaceWorkflows.filter((w) => isScheduledWorkflow(w)),
    [workspaceWorkflows]
  )

  return (
    <>
      {!isCollapsed && (
        <div className="group/section pt-5 pb-1.5 flex items-center justify-between">
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
          <Tooltip label="Add workflow" position="bottom">
            <button
              onClick={() => setWorkflowEditorOpen(true)}
              className="p-0.5 rounded text-gray-600 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <Zap size={13} strokeWidth={1.5} />
            </button>
          </Tooltip>
        </div>
      )}
      {isCollapsed && <div className="pt-4" />}

      {!isCollapsed && !sectionCollapsed && workspaceWorkflows.length === 0 && (
        <p className="text-[13px] text-gray-600 px-2.5 py-1">No workflows</p>
      )}

      {!isCollapsed && !sectionCollapsed && workspaceWorkflows.length > 0 && (
        <WorkflowSubGroup
          label="Manual"
          icon={<Zap size={11} strokeWidth={2} className="text-gray-600" />}
          count={manualWorkflows.length}
          defaultCollapsed={false}
        >
          {manualWorkflows.map((wf) => (
            <WorkflowItem
              key={wf.id}
              workflow={wf}
              isCollapsed={isCollapsed}
              iconSize={iconSize}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          ))}
        </WorkflowSubGroup>
      )}

      {!isCollapsed && !sectionCollapsed && workspaceWorkflows.length > 0 && (
        <WorkflowSubGroup
          label="Scheduled"
          icon={<Calendar size={11} strokeWidth={2} className="text-gray-600" />}
          count={scheduledWorkflows.length}
          defaultCollapsed={true}
        >
          {scheduledWorkflows.map((wf) => (
            <WorkflowItem
              key={wf.id}
              workflow={wf}
              isCollapsed={isCollapsed}
              iconSize={iconSize}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          ))}
        </WorkflowSubGroup>
      )}

      {isCollapsed &&
        workspaceWorkflows.map((wf) => (
          <WorkflowItem
            key={wf.id}
            workflow={wf}
            isCollapsed={isCollapsed}
            iconSize={iconSize}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
          />
        ))}
    </>
  )
}
