import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ptyManager as PtyManagerInstance } from '@vibegrid/server/pty-manager'
import type { AgentType, CreateTerminalPayload } from '@vibegrid/shared/types'

type PtyManager = typeof PtyManagerInstance

const AGENT_TYPES: [AgentType, ...AgentType[]] = [
  'claude',
  'copilot',
  'codex',
  'opencode',
  'gemini'
]

export function registerSessionTools(server: McpServer, deps: { ptyManager: PtyManager }): void {
  const { ptyManager } = deps

  server.tool('list_sessions', 'List all active terminal sessions', async () => {
    const sessions = ptyManager.getActiveSessions()
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
  })

  server.tool(
    'launch_agent',
    'Launch an AI agent in a new terminal session',
    {
      agent_type: z.enum(AGENT_TYPES).describe('Agent type to launch'),
      project_name: z.string().describe('Project name'),
      project_path: z.string().describe('Absolute path to project directory'),
      prompt: z.string().optional().describe('Initial prompt to send to the agent'),
      branch: z.string().optional().describe('Git branch to checkout'),
      use_worktree: z.boolean().optional().describe('Create a git worktree'),
      display_name: z.string().optional().describe('Display name for the session')
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
        const session = ptyManager.createPty(payload)
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
        return { content: [{ type: 'text', text: `Error launching agent: ${err}` }], isError: true }
      }
    }
  )

  server.tool(
    'kill_session',
    'Kill a terminal session',
    { id: z.string().describe('Session ID to kill') },
    async (args) => {
      try {
        ptyManager.killPty(args.id)
        return { content: [{ type: 'text', text: `Killed session: ${args.id}` }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error killing session: ${err}` }], isError: true }
      }
    }
  )

  server.tool(
    'write_to_terminal',
    'Send input to a running terminal session',
    {
      id: z.string().describe('Session ID'),
      data: z.string().describe('Data to write (text input to send to the agent)')
    },
    async (args) => {
      try {
        ptyManager.writeToPty(args.id, args.data)
        return { content: [{ type: 'text', text: `Wrote to session: ${args.id}` }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error writing to terminal: ${err}` }],
          isError: true
        }
      }
    }
  )
}
