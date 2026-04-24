import type {
  WorkflowDefinition,
  TaskStatusChangedTriggerConfig,
  LaunchAgentConfig,
  SourceConnection,
  ConnectorManifest,
  ConnectorPollTriggerConfig,
  CreateTaskFromItemConfig,
  TaskStatus
} from '@vornrun/shared/types'
import { connectorSeededWorkflowId } from '@vornrun/shared/types'

/** Stable id of the seeded "Default Task Workflow". */
export const DEFAULT_TASK_WORKFLOW_ID = 'system:default-task-workflow'

/**
 * Factory for the default task workflow seeded on first launch.
 *
 * Shape: a `taskStatusChanged` trigger (todo → in_progress, any project) wired
 * to a single headless `launchAgent` node whose `agentType` is `'fromTask'`.
 * At run time, `resolveEffectiveAgent` reads `task.assignedAgent` from the
 * trigger context, so the agent the user picks on each task is what actually
 * launches. The whole thing is editable in the workflow editor — users can
 * change the trigger, swap the agent, add steps, or disable/delete the
 * workflow outright. Nothing here is hidden or privileged; it's a worked
 * example that uses the same values any user could configure by hand.
 */
export function buildDefaultTaskWorkflow(): WorkflowDefinition {
  const triggerConfig: TaskStatusChangedTriggerConfig = {
    triggerType: 'taskStatusChanged',
    fromStatus: 'todo',
    toStatus: 'in_progress'
    // projectFilter omitted → fires in every project
  }

  const launchConfig: LaunchAgentConfig = {
    agentType: 'fromTask',
    projectName: '',
    projectPath: '',
    headless: true
  }

  return {
    id: DEFAULT_TASK_WORKFLOW_ID,
    name: 'Default Task Workflow',
    icon: 'Play',
    iconColor: '#10b981',
    enabled: true,
    workspaceId: 'personal',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        label: 'When task moves to In Progress',
        position: { x: 0, y: 0 },
        config: triggerConfig
      },
      {
        id: 'launch-1',
        type: 'launchAgent',
        label: 'Launch task agent',
        position: { x: 0, y: 120 },
        config: launchConfig
      }
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'launch-1' }]
  }
}

/**
 * Build a seeded workflow for a (connection × manifest event). The graph is
 * `[connectorPoll trigger] → [createTaskFromItem node]`. Fully visible and
 * editable in the workflow editor — users can add condition/launchAgent nodes
 * downstream, change the cron, or disable/delete it. The stable id means the
 * workflow is tied to this connection: deleting the connection removes its
 * seeded workflows, and deleting the workflow sticks because no background
 * process re-seeds (seeding only happens on connection:create).
 */
export function buildConnectorSeededWorkflow(
  connection: SourceConnection,
  manifest: ConnectorManifest,
  event: NonNullable<ConnectorManifest['defaultWorkflows']>[number]
): WorkflowDefinition {
  const id = connectorSeededWorkflowId(connection.id, event.event)
  const minutes = Math.max(1, Math.round(event.defaultCronFromMinutes))
  const cron = minutes === 1 ? '* * * * *' : `*/${minutes} * * * *`

  const triggerConfig: ConnectorPollTriggerConfig = {
    triggerType: 'connectorPoll',
    connectionId: connection.id,
    event: event.event,
    cron
  }

  // Pick a sensible initial status from the connector's statusMapping (if any),
  // else default to 'todo'. The user can change this in the node's config form.
  const initialStatus: TaskStatus =
    (manifest.statusMapping && manifest.statusMapping[0]?.suggestedLocal) || 'todo'

  const nodeConfig: CreateTaskFromItemConfig = {
    nodeType: 'createTaskFromItem',
    project: 'fromConnection',
    initialStatus
  }

  return {
    id,
    name: event.name,
    icon: connection.connectorId,
    iconColor: '#64748b',
    enabled: true,
    workspaceId: 'personal',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        label: `Poll ${manifest.triggers?.find((t) => t.type === event.event)?.label || event.event}`,
        position: { x: 0, y: 0 },
        config: triggerConfig
      },
      {
        id: 'create-1',
        type: 'createTaskFromItem',
        label: 'Create task from item',
        position: { x: 0, y: 120 },
        config: nodeConfig
      }
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'create-1' }]
  }
}
