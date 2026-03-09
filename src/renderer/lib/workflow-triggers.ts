import {
  WorkflowDefinition,
  TriggerConfig,
  TaskConfig,
  TaskStatus
} from '../../shared/types'
import { executeWorkflow } from './workflow-execution'
import { useAppStore } from '../stores'

function getTriggerConfig(wf: WorkflowDefinition): TriggerConfig | null {
  const triggerNode = wf.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return null
  return triggerNode.config as TriggerConfig
}

/**
 * Called after a task is created. Fires any workflows with a `taskCreated` trigger
 * that match the task's project.
 */
export function fireTaskCreatedTrigger(task: TaskConfig): void {
  const workflows = (useAppStore.getState().config?.workflows || []).filter((wf) => wf.enabled)

  for (const wf of workflows) {
    const trigger = getTriggerConfig(wf)
    if (!trigger || trigger.triggerType !== 'taskCreated') continue
    if (trigger.projectFilter && trigger.projectFilter !== task.projectName) continue

    executeWorkflow(wf)
  }
}

/**
 * Called after a task's status changes. Fires any workflows with a `taskStatusChanged` trigger
 * that match the transition and project.
 */
export function fireTaskStatusChangedTrigger(
  task: TaskConfig,
  fromStatus: TaskStatus,
  toStatus: TaskStatus
): void {
  if (fromStatus === toStatus) return

  const workflows = (useAppStore.getState().config?.workflows || []).filter((wf) => wf.enabled)

  for (const wf of workflows) {
    const trigger = getTriggerConfig(wf)
    if (!trigger || trigger.triggerType !== 'taskStatusChanged') continue
    if (trigger.projectFilter && trigger.projectFilter !== task.projectName) continue
    if (trigger.fromStatus && trigger.fromStatus !== fromStatus) continue
    if (trigger.toStatus && trigger.toStatus !== toStatus) continue

    executeWorkflow(wf)
  }
}
