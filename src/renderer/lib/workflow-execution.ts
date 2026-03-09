import {
  WorkflowDefinition,
  WorkflowExecution,
  NodeExecutionState,
  LaunchAgentConfig
} from '../../shared/types'
import { getOrderedActionNodes } from './workflow-helpers'
import { useAppStore } from '../stores'

export async function executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowExecution> {
  const execution: WorkflowExecution = {
    workflowId: workflow.id,
    startedAt: new Date().toISOString(),
    status: 'running',
    nodeStates: workflow.nodes.map((n) => ({
      nodeId: n.id,
      status: n.type === 'trigger' ? 'success' : 'pending'
    }))
  }

  useAppStore.getState().setWorkflowExecution(workflow.id, execution)

  const actionNodes = getOrderedActionNodes(workflow)

  try {
    for (let i = 0; i < actionNodes.length; i++) {
      const node = actionNodes[i]
      const config = node.config as LaunchAgentConfig

      if (i > 0 && workflow.staggerDelayMs) {
        await new Promise((r) => setTimeout(r, workflow.staggerDelayMs))
      }

      // Update node status to running
      updateNodeState(execution, node.id, { status: 'running', startedAt: new Date().toISOString() })
      useAppStore.getState().setWorkflowExecution(workflow.id, { ...execution })

      // Resolve prompt from task if applicable
      let initialPrompt = config.prompt
      let resolvedTaskId: string | undefined
      let branch = config.branch
      let useWorktree = config.useWorktree
      const currentState = useAppStore.getState()

      if (config.taskId) {
        const task = (currentState.config?.tasks || []).find(
          (t) => t.id === config.taskId && t.status === 'todo'
        )
        if (task) {
          initialPrompt = task.description
          resolvedTaskId = task.id
          branch = task.branch || branch
          useWorktree = task.useWorktree || useWorktree
        }
      } else if (config.taskFromQueue) {
        const task = currentState.getNextTask(config.projectName)
        if (task) {
          initialPrompt = task.description
          resolvedTaskId = task.id
          branch = task.branch || branch
          useWorktree = task.useWorktree || useWorktree
        }
      }

      const session = await window.api.createTerminal({
        agentType: config.agentType,
        projectName: config.projectName,
        projectPath: config.projectPath,
        displayName: config.displayName,
        branch,
        useWorktree,
        initialPrompt,
        promptDelayMs: config.promptDelayMs
      })
      useAppStore.getState().addTerminal(session)

      if (resolvedTaskId) {
        useAppStore.getState().startTask(resolvedTaskId, session.id, config.agentType)
      }

      updateNodeState(execution, node.id, {
        status: 'success',
        completedAt: new Date().toISOString(),
        sessionId: session.id
      })
      useAppStore.getState().setWorkflowExecution(workflow.id, { ...execution })
    }

    execution.status = 'success'
    execution.completedAt = new Date().toISOString()
  } catch (err) {
    execution.status = 'error'
    execution.completedAt = new Date().toISOString()
  }

  useAppStore.getState().setWorkflowExecution(workflow.id, { ...execution })

  // Show notification
  if (Notification.permission === 'granted') {
    const count = actionNodes.length
    new Notification('VibeGrid', {
      body: `Workflow "${workflow.name}" ${execution.status === 'success' ? 'started' : 'failed'} — ${count} session${count !== 1 ? 's' : ''} launched`
    })
  }

  return execution
}

function updateNodeState(
  execution: WorkflowExecution,
  nodeId: string,
  updates: Partial<NodeExecutionState>
): void {
  const state = execution.nodeStates.find((s) => s.nodeId === nodeId)
  if (state) {
    Object.assign(state, updates)
  }
}
