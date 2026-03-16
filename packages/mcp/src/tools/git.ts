import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  listBranches,
  listRemoteBranches,
  getGitBranch,
  getGitDiffStat,
  getGitDiffFull,
  gitCommit,
  gitPush,
  listWorktrees,
  createWorktree,
  isWorktreeDirty
} from '@vibegrid/server/git-utils'
import { V } from '../validation'

export function registerGitTools(server: McpServer): void {
  server.tool(
    'list_branches',
    'List git branches for a project',
    { project_path: V.absolutePath.describe('Absolute path to project directory') },
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
    'list_remote_branches',
    'List remote git branches for a project',
    { project_path: V.absolutePath.describe('Absolute path to project directory') },
    async (args) => {
      try {
        const remote = listRemoteBranches(args.project_path)
        return { content: [{ type: 'text', text: JSON.stringify(remote, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error listing remote branches: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'get_diff',
    'Get git diff for a project (staged and unstaged changes)',
    { project_path: V.absolutePath.describe('Absolute path to project directory') },
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

  server.tool(
    'get_diff_stat',
    'Get a summary of git changes (files changed, insertions, deletions)',
    { project_path: V.absolutePath.describe('Absolute path to project directory') },
    async (args) => {
      try {
        const result = getGitDiffStat(args.project_path)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error getting diff stat: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'git_commit',
    'Create a git commit',
    {
      project_path: V.absolutePath.describe('Absolute path to project directory'),
      message: V.description.describe('Commit message'),
      include_unstaged: z.boolean().optional().describe('Stage all changes before committing')
    },
    async (args) => {
      try {
        const result = gitCommit(args.project_path, args.message, args.include_unstaged ?? false)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error committing: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'git_push',
    'Push commits to the remote repository',
    { project_path: V.absolutePath.describe('Absolute path to project directory') },
    async (args) => {
      try {
        const result = gitPush(args.project_path)
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error pushing: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'list_worktrees',
    'List git worktrees for a project',
    { project_path: V.absolutePath.describe('Absolute path to project directory') },
    async (args) => {
      try {
        const worktrees = listWorktrees(args.project_path)
        return { content: [{ type: 'text', text: JSON.stringify(worktrees, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error listing worktrees: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'create_worktree',
    'Create a git worktree for a branch',
    {
      project_path: V.absolutePath.describe('Absolute path to project directory'),
      branch: V.shortText.describe('Branch name for the worktree')
    },
    async (args) => {
      try {
        const worktreePath = createWorktree(args.project_path, args.branch)
        return {
          content: [{ type: 'text', text: JSON.stringify({ path: worktreePath }, null, 2) }]
        }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error creating worktree: ${err}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'worktree_dirty',
    'Check if a worktree has uncommitted changes',
    { worktree_path: V.absolutePath.describe('Absolute path to the worktree') },
    async (args) => {
      try {
        const dirty = isWorktreeDirty(args.worktree_path)
        return { content: [{ type: 'text', text: JSON.stringify({ dirty }, null, 2) }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error checking worktree: ${err}` }],
          isError: true
        }
      }
    }
  )
}
