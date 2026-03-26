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
import { rpcCall, rpcNotify } from '../ws-client'

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
    'List terminal sessions. Filter by status: "active" (running terminals), "recent" (past sessions), or "archived".',
    {
      filter: z
        .enum(['active', 'recent', 'archived'])
        .optional()
        .describe('Session filter (default: active)'),
      project_name: V.name.optional().describe('Filter by project name'),
      project_path: V.absolutePath
        .optional()
        .describe('Filter by project path (for recent sessions)')
    },
    async (args) => {
      const filter = args.filter ?? 'active'
      try {
        if (filter === 'active') {
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
        } else if (filter === 'recent') {
          const sessions = await rpcCall<RecentSession[]>('sessions:getRecent', args.project_path)
          return { content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }] }
        } else {
          const sessions = await rpcCall<ArchivedSession[]>('session:listArchived')
          return { content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }] }
        }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'launch_session',
    'Launch an AI agent session (interactive terminal or headless). Requires the VibeGrid app to be running.',
    {
      agent_type: z.enum(AGENT_TYPES).describe('Agent type to launch'),
      project_name: V.name.describe('Project name'),
      project_path: V.absolutePath.describe('Absolute path to project directory'),
      prompt: V.prompt.optional().describe('Initial prompt to send to the agent'),
      branch: V.shortText.optional().describe('Git branch to checkout'),
      use_worktree: z.boolean().optional().describe('Create a git worktree'),
      display_name: V.shortText.optional().describe('Display name for the session'),
      headless: z.boolean().optional().describe('Launch as headless (no UI) session')
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

      const rpcMethod = args.headless ? 'headless:create' : 'terminal:create'
      const label = args.headless ? 'headless' : 'terminal'

      try {
        const session = await rpcCall<TerminalSession | HeadlessSession>(rpcMethod, payload)
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
              text: `Error launching ${label} agent: ${err instanceof Error ? err.message : err}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'kill_session',
    'Kill a terminal or headless session. Requires the VibeGrid app to be running.',
    {
      id: V.id.describe('Session ID to kill'),
      headless: z.boolean().optional().describe('Kill a headless session instead of a terminal')
    },
    async (args) => {
      const rpcMethod = args.headless ? 'headless:kill' : 'terminal:kill'
      const label = args.headless ? 'headless session' : 'session'
      try {
        await rpcCall(rpcMethod, args.id)
        return { content: [{ type: 'text', text: `Killed ${label}: ${args.id}` }] }
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error killing ${label}: ${err instanceof Error ? err.message : err}`
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
        // Append carriage return so the terminal submits the input.
        // Treat both \r and \n as already terminated to avoid double-submission.
        const trimmed = args.data.replace(/[\r\n]+$/, '')
        const data = trimmed + '\r'
        await rpcNotify('terminal:write', { id: args.id, data })
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
