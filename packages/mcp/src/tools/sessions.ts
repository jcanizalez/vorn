import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type {
  AgentType,
  CreateTerminalPayload,
  TerminalSession,
  HeadlessSession,
  RecentSession,
  ArchivedSession
} from '@vibegrid/shared/types'
import { V } from '../validation'
import { rpcCall } from '../ws-client'

const AGENT_TYPES: [AgentType, ...AgentType[]] = [
  'claude',
  'copilot',
  'codex',
  'opencode',
  'gemini'
]

export function registerSessionTools(server: McpServer): void {
  server.tool(
    'list_sessions',
    'List all active terminal sessions. Requires the VibeGrid app to be running.',
    {
      project_name: V.name.optional().describe('Filter by project name')
    },
    async (args) => {
      try {
        let sessions = await rpcCall<TerminalSession[]>('terminal:listActive')
        if (args.project_name) {
          sessions = sessions.filter((s) => s.projectName === args.project_name)
        }
        const summary = sessions.map((s) => ({
          id: s.id,
          agentType: s.agentType,
          projectName: s.projectName,
          status: s.status,
          displayName: s.displayName,
          branch: s.branch,
          pid: s.pid
        }))
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'list_recent_sessions',
    'List recent session history for a project. Requires the VibeGrid app to be running.',
    {
      project_path: V.absolutePath.optional().describe('Filter by project path')
    },
    async (args) => {
      try {
        const sessions = await rpcCall<RecentSession[]>('sessions:getRecent', args.project_path)
        return { content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'list_archived_sessions',
    'List archived sessions. Requires the VibeGrid app to be running.',
    async () => {
      try {
        const sessions = await rpcCall<ArchivedSession[]>('session:listArchived')
        return { content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'launch_agent',
    'Launch an AI agent in a new terminal session. Requires the VibeGrid app to be running.',
    {
      agent_type: z.enum(AGENT_TYPES).describe('Agent type to launch'),
      project_name: V.name.describe('Project name'),
      project_path: V.absolutePath.describe('Absolute path to project directory'),
      prompt: V.prompt.optional().describe('Initial prompt to send to the agent'),
      branch: V.shortText.optional().describe('Git branch to checkout'),
      use_worktree: z.boolean().optional().describe('Create a git worktree'),
      display_name: V.shortText.optional().describe('Display name for the session')
    },
    async (args) => {
      const payload: CreateTerminalPayload = {
        agentType: args.agent_type as AgentType,
        projectName: args.project_name,
        projectPath: args.project_path,
        ...(args.prompt && { initialPrompt: args.prompt }),
        ...(args.branch && { branch: args.branch }),
        ...(args.use_worktree && { useWorktree: args.use_worktree }),
        ...(args.display_name && { displayName: args.display_name })
      }

      try {
        const session = await rpcCall<TerminalSession>('terminal:create', payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: session.id,
                  agentType: session.agentType,
                  projectName: session.projectName,
                  pid: session.pid,
                  status: session.status
                },
                null,
                2
              )
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error launching agent: ${err instanceof Error ? err.message : err}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'launch_headless',
    'Launch a headless (no UI) agent session. Requires the VibeGrid app to be running.',
    {
      agent_type: z.enum(AGENT_TYPES).describe('Agent type to launch'),
      project_name: V.name.describe('Project name'),
      project_path: V.absolutePath.describe('Absolute path to project directory'),
      prompt: V.prompt.optional().describe('Initial prompt to send to the agent'),
      branch: V.shortText.optional().describe('Git branch to checkout'),
      use_worktree: z.boolean().optional().describe('Create a git worktree'),
      display_name: V.shortText.optional().describe('Display name for the session')
    },
    async (args) => {
      const payload: CreateTerminalPayload = {
        agentType: args.agent_type as AgentType,
        projectName: args.project_name,
        projectPath: args.project_path,
        ...(args.prompt && { initialPrompt: args.prompt }),
        ...(args.branch && { branch: args.branch }),
        ...(args.use_worktree && { useWorktree: args.use_worktree }),
        ...(args.display_name && { displayName: args.display_name })
      }

      try {
        const session = await rpcCall<HeadlessSession>('headless:create', payload)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: session.id,
                  agentType: session.agentType,
                  projectName: session.projectName,
                  pid: session.pid,
                  status: session.status
                },
                null,
                2
              )
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error launching headless agent: ${err instanceof Error ? err.message : err}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'kill_session',
    'Kill a terminal session. Requires the VibeGrid app to be running.',
    { id: V.id.describe('Session ID to kill') },
    async (args) => {
      try {
        await rpcCall('terminal:kill', args.id)
        return { content: [{ type: 'text', text: `Killed session: ${args.id}` }] }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error killing session: ${err instanceof Error ? err.message : err}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'kill_headless',
    'Kill a headless agent session. Requires the VibeGrid app to be running.',
    { id: V.id.describe('Headless session ID to kill') },
    async (args) => {
      try {
        await rpcCall('headless:kill', args.id)
        return { content: [{ type: 'text', text: `Killed headless session: ${args.id}` }] }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error killing headless session: ${err instanceof Error ? err.message : err}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'write_to_terminal',
    'Send input to a running terminal session. Requires the VibeGrid app to be running.',
    {
      id: V.id.describe('Session ID'),
      data: z
        .string()
        .max(50000, 'Data must be 50000 characters or less')
        .describe('Data to write (text input to send to the agent)')
    },
    async (args) => {
      try {
        await rpcCall('terminal:write', { id: args.id, data: args.data })
        return { content: [{ type: 'text', text: `Wrote to session: ${args.id}` }] }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error writing to terminal: ${err instanceof Error ? err.message : err}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
