import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionContext,
  NodeExecutionState,
  LaunchAgentConfig
} from '../../shared/types'
import { getOrderedActionNodes } from './workflow-helpers'
import { resolveTemplateVars } from './template-vars'
import { useAppStore } from '../stores'

/** Save execution to both in-memory store and database */
function persistExecution(workflowId: string, execution: WorkflowExecution): void {
  useAppStore.getState().setWorkflowExecution(workflowId, { ...execution })
  window.api.saveWorkflowRun(execution)
}

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  context?: WorkflowExecutionContext
): Promise<WorkflowExecution> {
  const execution: WorkflowExecution = {
    workflowId: workflow.id,
    startedAt: new Date().toISOString(),
    status: 'running',
    nodeStates: workflow.nodes.map((n) => ({
      nodeId: n.id,
      status: n.type === 'trigger' ? 'success' : 'pending'
    })),
    triggerTaskId: context?.task?.id
  }

  const actionNodes = getOrderedActionNodes(workflow)
  console.log(`[workflow] executeWorkflow "${workflow.name}" — ${actionNodes.length} action nodes, triggerTaskId=${context?.task?.id}`)

  // Persist immediately so the run is visible in the UI from the start
  persistExecution(workflow.id, execution)

  try {
    for (let i = 0; i < actionNodes.length; i++) {
      const node = actionNodes[i]
      const config = node.config as LaunchAgentConfig
      console.log(`[workflow] node ${i}: ${node.label} headless=${config.headless} prompt="${(config.prompt || '').slice(0, 50)}"`)

      if (i > 0 && workflow.staggerDelayMs) {
        await new Promise((r) => setTimeout(r, workflow.staggerDelayMs))
      }

      // Update node status to running
      updateNodeState(execution, node.id, { status: 'running', startedAt: new Date().toISOString() })
      persistExecution(workflow.id, execution)

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

      // Apply template variable substitution
      if (initialPrompt) {
        initialPrompt = resolveTemplateVars(initialPrompt, context)
      }

      if (config.headless) {
        // Headless execution — run process directly without terminal
        console.log(`[workflow] creating headless session for "${node.label}" prompt="${(initialPrompt || '').slice(0, 80)}"`)

        // Register listeners BEFORE creating the session to avoid race conditions
        // (fast-exiting processes can fire exit before listeners are set up)
        let sessionId: string | null = null
        let logs = ''

        const removeDataListener = window.api.onHeadlessData(({ id, data }: { id: string; data: string }) => {
          if (sessionId && id === sessionId) {
            logs += data
            if (logs.length > 100000) {
              logs = logs.slice(-80000)
            }
            updateNodeState(execution, node.id, { logs })
            useAppStore.getState().setWorkflowExecution(workflow.id, { ...execution })
          }
        })

        let resolveExit: (code: number) => void
        const exitPromise = new Promise<number>((resolve) => { resolveExit = resolve })

        const removeExitListener = window.api.onHeadlessExit(({ id, exitCode: code }: { id: string; exitCode: number }) => {
          if (sessionId && id === sessionId) {
            resolveExit(code)
          }
        })

        try {
          const headlessSession = await window.api.createHeadlessSession({
            agentType: config.agentType,
            projectName: config.projectName,
            projectPath: config.projectPath,
            displayName: config.displayName,
            branch,
            useWorktree,
            initialPrompt,
            promptDelayMs: config.promptDelayMs,
            headless: true
          })

          // Set sessionId so the pre-registered listeners start matching
          sessionId = headlessSession.id

          updateNodeState(execution, node.id, { sessionId: headlessSession.id, taskId: resolvedTaskId })
          persistExecution(workflow.id, execution)

          if (resolvedTaskId) {
            useAppStore.getState().startTask(resolvedTaskId, headlessSession.id, config.agentType)
          }

          // Wait for the headless process to exit
          const exitCode = await exitPromise

          if (exitCode !== 0) {
            logs += `\nProcess exited with code ${exitCode}`
          }

          updateNodeState(execution, node.id, {
            status: exitCode === 0 ? 'success' : 'error',
            completedAt: new Date().toISOString(),
            logs,
            ...(exitCode !== 0 && { error: `Exit code ${exitCode}` })
          })
          persistExecution(workflow.id, execution)
        } finally {
          // Always clean up listeners to prevent leaks if createHeadlessSession
          // or exitPromise throws/rejects
          removeDataListener()
          removeExitListener()
        }
      } else {
        // Standard terminal execution
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
          sessionId: session.id,
          logs: `Terminal session created: ${session.id}`,
          taskId: resolvedTaskId
        })
        persistExecution(workflow.id, execution)
      }
    }

    const hasErrors = execution.nodeStates.some((ns) => ns.status === 'error')
    execution.status = hasErrors ? 'error' : 'success'
    execution.completedAt = new Date().toISOString()
  } catch (err) {
    console.error(`[workflow] execution error:`, err)
    execution.status = 'error'
    execution.completedAt = new Date().toISOString()
    // Mark any still-running nodes as error
    for (const ns of execution.nodeStates) {
      if (ns.status === 'running' || ns.status === 'pending') {
        ns.status = 'error'
        ns.completedAt = execution.completedAt
        ns.error = err instanceof Error ? err.message : String(err)
      }
    }
  }

  // Capture agentSessionId from terminal sessions (hookSessionId) before final persist
  const terminals = useAppStore.getState().terminals
  for (const ns of execution.nodeStates) {
    if (ns.sessionId && !ns.agentSessionId) {
      const terminal = terminals.get(ns.sessionId)
      if (terminal?.hookSessionId) {
        ns.agentSessionId = terminal.hookSessionId
      }
    }
  }

  // Final persist
  persistExecution(workflow.id, execution)

  // Show notification
  if (Notification.permission === 'granted') {
    const count = actionNodes.length
    new Notification('VibeGrid', {
      body: `Workflow "${workflow.name}" ${execution.status === 'success' ? 'completed' : 'failed'} — ${count} node${count !== 1 ? 's' : ''}`
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
