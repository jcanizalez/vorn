import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listBranches, getGitBranch, getGitDiffFull } from '@vibegrid/server/git-utils'

export function registerGitTools(server: McpServer): void {
  server.tool(
    'list_branches',
    'List git branches for a project',
    { project_path: z.string().describe('Absolute path to project directory') },
    async (args) => {
      try {
        const local = listBranches(args.project_path)
        const current = getGitBranch(args.project_path)
        return {
          content: [{ type: 'text', text: JSON.stringify({ current, branches: local }, null, 2) }]
        }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error listing branches: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'get_diff',
    'Get git diff for a project (staged and unstaged changes)',
    { project_path: z.string().describe('Absolute path to project directory') },
    async (args) => {
      try {
        const result = getGitDiffFull(args.project_path)
        if (!result) {
          return {
            content: [{ type: 'text', text: 'No changes detected or not a git repository' }]
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: `Error getting diff: ${err}` }], isError: true }
      }
    }
  )
}
