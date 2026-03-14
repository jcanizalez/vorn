import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { configManager as ConfigManagerInstance } from '@vibegrid/server/config-manager'
import type { AgentType } from '@vibegrid/shared/types'
import {
  dbListProjects,
  dbGetProject,
  dbInsertProject,
  dbUpdateProject,
  dbDeleteProject
} from '@vibegrid/server/database'

type ConfigManager = typeof ConfigManagerInstance

const AGENT_TYPES: [AgentType, ...AgentType[]] = [
  'claude',
  'copilot',
  'codex',
  'opencode',
  'gemini'
]

export function registerProjectTools(
  server: McpServer,
  deps: { configManager: ConfigManager }
): void {
  const { configManager } = deps

  server.tool('list_projects', 'List all projects', async () => {
    const projects = dbListProjects()
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] }
  })

  server.tool(
    'create_project',
    'Create a new project',
    {
      name: z.string().describe('Project name (unique identifier)'),
      path: z.string().describe('Absolute path to project directory'),
      preferred_agents: z.array(z.enum(AGENT_TYPES)).optional().describe('Preferred agent types'),
      icon: z.string().optional().describe('Lucide icon name'),
      icon_color: z.string().optional().describe('Hex color for icon')
    },
    async (args) => {
      if (dbGetProject(args.name)) {
        return {
          content: [{ type: 'text', text: `Error: project "${args.name}" already exists` }],
          isError: true
        }
      }

      const project = {
        name: args.name,
        path: args.path,
        preferredAgents: (args.preferred_agents as AgentType[]) ?? [],
        ...(args.icon && { icon: args.icon }),
        ...(args.icon_color && { iconColor: args.icon_color })
      }

      dbInsertProject(project)
      configManager.notifyChanged()

      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] }
    }
  )

  server.tool(
    'update_project',
    "Update a project's properties",
    {
      name: z.string().describe('Project name (identifier, cannot be changed)'),
      path: z.string().optional().describe('New project path'),
      preferred_agents: z.array(z.enum(AGENT_TYPES)).optional().describe('Preferred agent types'),
      icon: z.string().optional().describe('Lucide icon name'),
      icon_color: z.string().optional().describe('Hex color for icon')
    },
    async (args) => {
      if (!dbGetProject(args.name)) {
        return {
          content: [{ type: 'text', text: `Error: project "${args.name}" not found` }],
          isError: true
        }
      }

      const updates: Record<string, unknown> = {}
      if (args.path !== undefined) updates.path = args.path
      if (args.preferred_agents !== undefined)
        updates.preferredAgents = args.preferred_agents as AgentType[]
      if (args.icon !== undefined) updates.icon = args.icon
      if (args.icon_color !== undefined) updates.iconColor = args.icon_color

      dbUpdateProject(args.name, updates)
      configManager.notifyChanged()

      const updated = dbGetProject(args.name)
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] }
    }
  )

  server.tool(
    'delete_project',
    'Delete a project and all its tasks',
    { name: z.string().describe('Project name') },
    async (args) => {
      if (!dbGetProject(args.name)) {
        return {
          content: [{ type: 'text', text: `Error: project "${args.name}" not found` }],
          isError: true
        }
      }

      dbDeleteProject(args.name)
      configManager.notifyChanged()

      return { content: [{ type: 'text', text: `Deleted project: ${args.name}` }] }
    }
  )
}
