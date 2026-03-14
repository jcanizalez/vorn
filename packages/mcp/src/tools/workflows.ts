import crypto from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { configManager as ConfigManagerInstance } from '@vibegrid/server/config-manager'
import type { scheduler as SchedulerInstance } from '@vibegrid/server/scheduler'
import { V } from '../validation'
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  TriggerConfig,
  LaunchAgentConfig
} from '@vibegrid/shared/types'
import {
  dbListWorkflows,
  dbInsertWorkflow,
  dbUpdateWorkflow,
  dbDeleteWorkflow
} from '@vibegrid/server/database'

type ConfigManager = typeof ConfigManagerInstance
type Scheduler = typeof SchedulerInstance

const launchAgentConfigSchema = z.object({
  agentType: z.enum(['claude', 'copilot', 'codex', 'opencode', 'gemini']),
  projectName: V.name,
  projectPath: V.absolutePath,
  args: z.array(V.shortText).optional(),
  displayName: V.shortText.optional(),
  branch: V.shortText.optional(),
  useWorktree: z.boolean().optional(),
  remoteHostId: V.id.optional(),
  prompt: V.prompt.optional(),
  promptDelayMs: z.number().optional(),
  taskId: V.id.optional(),
  taskFromQueue: z.boolean().optional()
})

const triggerConfigSchema = z.union([
  z.object({ triggerType: z.literal('manual') }),
  z.object({ triggerType: z.literal('once'), runAt: V.shortText }),
  z.object({
    triggerType: z.literal('recurring'),
    cron: V.shortText,
    timezone: V.shortText.optional()
  }),
  z.object({ triggerType: z.literal('taskCreated'), projectFilter: V.name.optional() }),
  z.object({
    triggerType: z.literal('taskStatusChanged'),
    projectFilter: V.name.optional(),
    fromStatus: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional(),
    toStatus: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']).optional()
  })
])

const nodeSchema = z.object({
  id: V.id,
  type: z.enum(['trigger', 'launchAgent']),
  label: V.shortText,
  config: z.record(z.unknown()),
  position: z.object({ x: z.number(), y: z.number() })
})

const edgeSchema = z.object({
  id: V.id,
  source: V.id,
  target: V.id
})

/**
 * Build a workflow graph from a flat action list + trigger config (convenience format).
 */
function buildGraphFromFlat(
  trigger: TriggerConfig,
  actions: LaunchAgentConfig[]
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []

  const triggerNode: WorkflowNode = {
    id: crypto.randomUUID(),
    type: 'trigger',
    label:
      trigger.triggerType === 'manual'
        ? 'Manual Trigger'
        : trigger.triggerType === 'once'
          ? 'Schedule (Once)'
          : trigger.triggerType === 'recurring'
            ? 'Schedule (Recurring)'
            : trigger.triggerType === 'taskCreated'
              ? 'When Task Created'
              : trigger.triggerType === 'taskStatusChanged'
                ? 'When Task Status Changes'
                : 'Trigger',
    config: trigger,
    position: { x: 0, y: 0 }
  }
  nodes.push(triggerNode)

  let prevId = triggerNode.id
  const NODE_GAP = 140

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]
    const nodeId = crypto.randomUUID()
    nodes.push({
      id: nodeId,
      type: 'launchAgent',
      label: `Launch ${action.agentType}`,
      config: action,
      position: { x: 0, y: (i + 1) * NODE_GAP }
    })
    edges.push({
      id: crypto.randomUUID(),
      source: prevId,
      target: nodeId
    })
    prevId = nodeId
  }

  return { nodes, edges }
}

export function registerWorkflowTools(
  server: McpServer,
  deps: { configManager: ConfigManager; scheduler: Scheduler }
): void {
  const { configManager, scheduler } = deps

  server.tool('list_workflows', 'List all workflows', async () => {
    const workflows = dbListWorkflows()
    return { content: [{ type: 'text', text: JSON.stringify(workflows, null, 2) }] }
  })

  server.tool(
    'create_workflow',
    'Create a new workflow. Accepts either full nodes/edges or a convenience flat format (trigger + actions array).',
    z.object({
      name: V.title.describe('Workflow name'),
      trigger: triggerConfigSchema
        .optional()
        .describe('Trigger config (convenience mode). Defaults to manual.'),
      actions: z
        .array(launchAgentConfigSchema)
        .optional()
        .describe('Actions to execute (convenience mode). Auto-generates graph.'),
      nodes: z.array(nodeSchema).optional().describe('Full graph nodes (advanced mode)'),
      edges: z.array(edgeSchema).optional().describe('Full graph edges (advanced mode)'),
      icon: V.shortText.optional().describe('Lucide icon name (default: zap)'),
      icon_color: V.hexColor.optional().describe('Hex color (default: #6366f1)'),
      enabled: z.boolean().optional().describe('Whether workflow is enabled (default: true)'),
      stagger_delay_ms: z.number().optional().describe('Delay in ms between actions')
    }),
    async (args) => {
      let nodes: WorkflowNode[]
      let edges: WorkflowEdge[]

      if (args.nodes && args.edges) {
        nodes = args.nodes as unknown as WorkflowNode[]
        edges = args.edges as unknown as WorkflowEdge[]
      } else {
        const trigger = (args.trigger as TriggerConfig) ?? { triggerType: 'manual' as const }
        const actions = (args.actions as LaunchAgentConfig[]) ?? []
        const graph = buildGraphFromFlat(trigger, actions)
        nodes = graph.nodes
        edges = graph.edges
      }

      const workflow: WorkflowDefinition = {
        id: crypto.randomUUID(),
        name: args.name,
        icon: args.icon ?? 'zap',
        iconColor: args.icon_color ?? '#6366f1',
        nodes,
        edges,
        enabled: args.enabled ?? true,
        ...(args.stagger_delay_ms && { staggerDelayMs: args.stagger_delay_ms })
      }

      dbInsertWorkflow(workflow)
      scheduler.syncSchedules(dbListWorkflows())
      configManager.notifyChanged()

      return { content: [{ type: 'text', text: JSON.stringify(workflow, null, 2) }] }
    }
  )

  server.tool(
    'update_workflow',
    "Update a workflow's properties",
    z.object({
      id: V.id.describe('Workflow ID'),
      name: V.title.optional(),
      nodes: z.array(nodeSchema).optional(),
      edges: z.array(edgeSchema).optional(),
      icon: V.shortText.optional(),
      icon_color: V.hexColor.optional(),
      enabled: z.boolean().optional(),
      stagger_delay_ms: z.number().optional()
    }),
    async (args) => {
      const workflows = dbListWorkflows()
      const workflow = workflows.find((w) => w.id === args.id)
      if (!workflow) {
        return {
          content: [{ type: 'text', text: `Error: workflow "${args.id}" not found` }],
          isError: true
        }
      }

      const updates: Partial<WorkflowDefinition> = {}
      if (args.name !== undefined) updates.name = args.name
      if (args.nodes !== undefined) updates.nodes = args.nodes as unknown as WorkflowNode[]
      if (args.edges !== undefined) updates.edges = args.edges as unknown as WorkflowEdge[]
      if (args.icon !== undefined) updates.icon = args.icon
      if (args.icon_color !== undefined) updates.iconColor = args.icon_color
      if (args.enabled !== undefined) updates.enabled = args.enabled
      if (args.stagger_delay_ms !== undefined) updates.staggerDelayMs = args.stagger_delay_ms

      dbUpdateWorkflow(args.id, updates)
      scheduler.syncSchedules(dbListWorkflows())
      configManager.notifyChanged()

      return {
        content: [{ type: 'text', text: JSON.stringify({ ...workflow, ...updates }, null, 2) }]
      }
    }
  )

  server.tool(
    'delete_workflow',
    'Delete a workflow',
    { id: V.id.describe('Workflow ID') },
    async (args) => {
      const workflows = dbListWorkflows()
      const workflow = workflows.find((w) => w.id === args.id)
      if (!workflow) {
        return {
          content: [{ type: 'text', text: `Error: workflow "${args.id}" not found` }],
          isError: true
        }
      }

      dbDeleteWorkflow(args.id)
      scheduler.syncSchedules(dbListWorkflows())
      configManager.notifyChanged()

      return { content: [{ type: 'text', text: `Deleted workflow: ${workflow.name}` }] }
    }
  )
}
