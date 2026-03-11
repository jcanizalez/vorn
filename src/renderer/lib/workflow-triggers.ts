import {
  WorkflowDefinition,
  TriggerConfig,
  TaskConfig,
  TaskStatus,
  WorkflowExecutionContext
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
  console.log(`[triggers] fireTaskCreatedTrigger: task="${task.title}" project="${task.projectName}" workflows=${workflows.length}`)

  for (const wf of workflows) {
    const trigger = getTriggerConfig(wf)
    if (!trigger || trigger.triggerType !== 'taskCreated') {
      console.log(`[triggers] skip "${wf.name}": triggerType=${trigger?.triggerType}`)
      continue
    }
    if (trigger.projectFilter && trigger.projectFilter !== task.projectName) {
      console.log(`[triggers] skip "${wf.name}": projectFilter=${trigger.projectFilter} != ${task.projectName}`)
      continue
    }

    console.log(`[triggers] executing "${wf.name}" for task "${task.title}"`)
    executeWorkflow(wf, {
      task,
      trigger: { type: 'taskCreated' }
    }).catch((err) => console.error(`[triggers] executeWorkflow error:`, err))
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

    const context: WorkflowExecutionContext = {
      task,
      trigger: { type: 'taskStatusChanged', fromStatus, toStatus }
    }
    executeWorkflow(wf, context).catch((err) => console.error(`[triggers] executeWorkflow error:`, err))
  }
}
