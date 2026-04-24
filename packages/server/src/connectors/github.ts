import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  VornConnector,
  ExternalItem,
  PollResult,
  ActionResult,
  ConnectorManifest,
  TaskStatus
} from '@vornrun/shared/types'
import log from '../logger'

const execFileAsync = promisify(execFile)

const TRANSIENT_CODES = new Set(['ETIMEDOUT', 'ENETDOWN', 'ENETUNREACH', 'ECONNRESET'])

function isTransientErr(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return typeof code === 'string' && TRANSIENT_CODES.has(code)
}

/**
 * Run `gh` with a 15s timeout. One retry on transient network errors so a
 * flaky WiFi blip doesn't kill a poll. Captures stderr into the error message
 * so gh's non-zero exit reasons (e.g. rate limiting, auth) surface in logs.
 */
async function gh(args: string[], cwd?: string, input?: string): Promise<string> {
  const run = async () => {
    if (input !== undefined) {
      return runWithStdin(args, input, cwd)
    }
    const { stdout } = await execFileAsync('gh', args, {
      timeout: 15_000,
      maxBuffer: 10 * 1024 * 1024,
      ...(cwd && { cwd })
    })
    return stdout
  }
  try {
    return await run()
  } catch (err: unknown) {
    if (isTransientErr(err)) {
      log.warn(`[github-connector] transient error, retrying once: ${String(err)}`)
      try {
        return await run()
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : String(retryErr)
        log.error(`[github-connector] gh command failed after retry: gh ${args.join(' ')} — ${msg}`)
        throw new Error(`gh command failed: ${msg}`, { cause: retryErr })
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    log.error(`[github-connector] gh command failed: gh ${args.join(' ')} — ${msg}`)
    throw new Error(`gh command failed: ${msg}`, { cause: err })
  }
}

/** Run `gh` feeding `input` on stdin. Used by `gh api --input -` paths so we
 *  never interpolate untrusted body values into shell arguments. */
function runWithStdin(args: string[], input: string, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { cwd, timeout: 15_000 })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) return resolve(stdout)
      reject(new Error(`gh exited with code ${code}: ${stderr.trim() || 'no stderr'}`))
    })
    child.stdin.write(input)
    child.stdin.end()
  })
}

/** Detect owner/repo from a git repo path using gh CLI */
export async function detectRepoSlug(
  projectPath: string
): Promise<{ owner: string; repo: string } | null> {
  try {
    const result = await gh(
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      projectPath
    )
    const slug = result.trim()
    if (!slug.includes('/')) return null
    const [owner, repo] = slug.split('/')
    return { owner, repo }
  } catch {
    return null
  }
}

/**
 * Invoke the GitHub REST API via `gh api`. For non-GET requests with a body,
 * the JSON body is piped over stdin using `--input -`, which side-steps shell
 * escaping entirely — no interpolation of untrusted values into `-f` flags,
 * no injection surface even if the body contains quotes/semicolons/newlines.
 */
async function ghApi(
  endpoint: string,
  method = 'GET',
  body?: Record<string, unknown>
): Promise<unknown> {
  const args = ['api', endpoint]
  if (method !== 'GET') {
    args.push('-X', method)
  }
  let result: string
  if (body && Object.keys(body).length > 0) {
    args.push('--input', '-')
    result = await gh(args, undefined, JSON.stringify(body))
  } else {
    result = await gh(args)
  }
  return result.trim() ? JSON.parse(result) : null
}

interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  updated_at: string
  created_at: string
  labels: Array<{ name: string }>
  assignee: { login: string } | null
  pull_request?: unknown
}

function issueToExternalItem(issue: GitHubIssue): ExternalItem {
  return {
    externalId: String(issue.number),
    url: issue.html_url,
    title: issue.title,
    description: issue.body || '',
    status: issue.state,
    labels: issue.labels?.map((l) => l.name) ?? [],
    assignee: issue.assignee?.login,
    updatedAt: issue.updated_at,
    metadata: { createdAt: issue.created_at }
  }
}

export const githubConnector: VornConnector = {
  id: 'github',
  name: 'GitHub',
  icon: 'github',
  capabilities: ['tasks', 'triggers', 'actions'],

  async listItems(filters: Record<string, unknown>): Promise<ExternalItem[]> {
    const { owner, repo, state = 'open', labels, assignee, per_page = 50 } = filters
    if (typeof owner !== 'string' || typeof repo !== 'string' || !owner || !repo) {
      throw new Error('owner and repo are required')
    }

    const params = new URLSearchParams({
      state: String(state),
      per_page: String(per_page)
    })
    if (labels) params.set('labels', String(labels))
    if (assignee) params.set('assignee', String(assignee))
    const endpoint = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${params}`
    // Exclude pull requests (GitHub API returns PRs in issues endpoint)
    const data = (await ghApi(endpoint)) as GitHubIssue[]
    return data.filter((i) => !i.pull_request).map(issueToExternalItem)
  },

  async getItem(
    externalId: string,
    filters: Record<string, unknown>
  ): Promise<ExternalItem | null> {
    const { owner, repo } = filters
    if (typeof owner !== 'string' || typeof repo !== 'string' || !owner || !repo) {
      throw new Error('owner and repo are required')
    }

    try {
      const issue = (await ghApi(
        `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(externalId)}`
      )) as GitHubIssue
      return issueToExternalItem(issue)
    } catch {
      return null
    }
  },

  async poll(
    triggerType: string,
    config: Record<string, unknown>,
    cursor?: string
  ): Promise<PollResult> {
    const { owner, repo } = config
    if (typeof owner !== 'string' || typeof repo !== 'string' || !owner || !repo) {
      return { events: [] }
    }

    const since = cursor || new Date(Date.now() - 60_000).toISOString()
    const PAGE_SIZE = 30
    const repoPath = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

    switch (triggerType) {
      case 'issueCreated': {
        const endpoint = `${repoPath}/issues?state=open&sort=created&direction=desc&since=${encodeURIComponent(since)}&per_page=${PAGE_SIZE}`
        const issues = (await ghApi(endpoint)) as GitHubIssue[]
        const newIssues = issues.filter((i) => !i.pull_request && i.created_at > since)
        // When we hit the page cap, advance the cursor only to the oldest
        // item we actually saw — there may be older items between `since`
        // and that point that got truncated by the per_page limit, and the
        // next poll needs to pick them up rather than skip them.
        const nextCursor =
          newIssues.length >= PAGE_SIZE && newIssues.length > 0
            ? newIssues[newIssues.length - 1].created_at
            : new Date().toISOString()
        return {
          events: newIssues.map((i) => ({
            id: String(i.number),
            type: 'issueCreated',
            data: issueToExternalItem(i) as unknown as Record<string, unknown>,
            timestamp: i.created_at
          })),
          nextCursor
        }
      }
      case 'prOpened': {
        const endpoint = `${repoPath}/pulls?state=open&sort=created&direction=desc&per_page=${PAGE_SIZE}`
        const prs = (await ghApi(endpoint)) as Array<{
          number: number
          title: string
          html_url: string
          created_at: string
          user: { login: string }
        }>
        const newPrs = prs.filter((pr) => pr.created_at > since)
        const nextCursor =
          newPrs.length >= PAGE_SIZE && newPrs.length > 0
            ? newPrs[newPrs.length - 1].created_at
            : new Date().toISOString()
        return {
          events: newPrs.map((pr) => ({
            id: String(pr.number),
            type: 'prOpened',
            data: {
              number: pr.number,
              title: pr.title,
              url: pr.html_url,
              author: pr.user.login
            },
            timestamp: pr.created_at
          })),
          nextCursor
        }
      }
      default:
        return { events: [] }
    }
  },

  async execute(actionType: string, args: Record<string, unknown>): Promise<ActionResult> {
    const { owner, repo } = args
    if (!owner || !repo) return { success: false, error: 'owner and repo are required' }

    switch (actionType) {
      case 'createIssue': {
        const { title, body, labels: issueLabels } = args
        if (!title) return { success: false, error: 'title is required' }
        const bodyArgs: Record<string, unknown> = {
          title: String(title)
        }
        if (body) bodyArgs.body = String(body)
        if (issueLabels) {
          bodyArgs.labels = String(issueLabels)
        }
        const result = await ghApi(`repos/${owner}/${repo}/issues`, 'POST', bodyArgs)
        return { success: true, output: result as Record<string, unknown> }
      }
      case 'closeIssue': {
        const { number: issueNumber } = args
        if (!issueNumber) return { success: false, error: 'number is required' }
        await ghApi(`repos/${owner}/${repo}/issues/${issueNumber}`, 'PATCH', { state: 'closed' })
        return { success: true }
      }
      case 'commentOnIssue': {
        const { number: num, body: comment } = args
        if (!num || !comment) return { success: false, error: 'number and body are required' }
        await ghApi(`repos/${owner}/${repo}/issues/${num}/comments`, 'POST', {
          body: String(comment)
        })
        return { success: true }
      }
      case 'syncTasks': {
        // This is handled by the sync engine at a higher level.
        // The action node calls listItems() and does the upsert logic.
        return { success: true }
      }
      default:
        return { success: false, error: `Unknown action: ${actionType}` }
    }
  },

  describe(): ConnectorManifest {
    return {
      auth: [], // gh CLI handles auth — no fields needed
      taskFilters: [
        {
          key: 'state',
          label: 'State',
          type: 'select',
          options: [
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
            { value: 'all', label: 'All' }
          ]
        },
        { key: 'labels', label: 'Labels', type: 'text', placeholder: 'bug,enhancement' },
        { key: 'assignee', label: 'Assignee', type: 'text', placeholder: 'username or @me' }
      ],
      statusMapping: [
        { upstream: 'open', suggestedLocal: 'todo' as TaskStatus },
        { upstream: 'closed', suggestedLocal: 'done' as TaskStatus }
      ],
      triggers: [
        {
          type: 'issueCreated',
          label: 'Issue Created',
          description: 'Fires when a new issue is created',
          configFields: [
            { key: 'owner', label: 'Owner', type: 'text', required: true },
            { key: 'repo', label: 'Repository', type: 'text', required: true },
            { key: 'labels', label: 'Filter by labels', type: 'text' }
          ],
          defaultIntervalMs: 30_000
        },
        {
          type: 'prOpened',
          label: 'PR Opened',
          description: 'Fires when a new pull request is opened',
          configFields: [
            { key: 'owner', label: 'Owner', type: 'text', required: true },
            { key: 'repo', label: 'Repository', type: 'text', required: true }
          ],
          defaultIntervalMs: 30_000
        }
      ],
      actions: [
        // Note: owner/repo are sourced from the connection's filters and
        // merged in server-side before connector.execute() runs — they're
        // deliberately not duplicated in these configFields so the action
        // form stays focused on per-call args.
        {
          type: 'createIssue',
          label: 'Create Issue',
          description: 'Create a new GitHub issue in the connected repo',
          configFields: [
            {
              key: 'title',
              label: 'Title',
              type: 'text',
              required: true,
              supportsTemplates: true
            },
            { key: 'body', label: 'Body', type: 'textarea', supportsTemplates: true },
            { key: 'labels', label: 'Labels', type: 'text', placeholder: 'bug,enhancement' }
          ]
        },
        {
          type: 'closeIssue',
          label: 'Close Issue',
          description: 'Close an issue in the connected repo',
          configFields: [
            {
              key: 'number',
              label: 'Issue #',
              type: 'text',
              required: true,
              placeholder: '{{connectorItem.externalId}}',
              supportsTemplates: true
            }
          ]
        },
        {
          type: 'commentOnIssue',
          label: 'Comment on Issue',
          description: 'Post a comment on an issue in the connected repo',
          configFields: [
            {
              key: 'number',
              label: 'Issue #',
              type: 'text',
              required: true,
              placeholder: '{{connectorItem.externalId}}',
              supportsTemplates: true
            },
            {
              key: 'body',
              label: 'Comment',
              type: 'textarea',
              required: true,
              supportsTemplates: true
            }
          ]
        }
      ],
      defaultWorkflows: [
        {
          name: 'GitHub: Issue Created',
          event: 'issueCreated',
          defaultCronFromMinutes: 5,
          downstream: 'createTaskFromItem'
        },
        {
          name: 'GitHub: PR Opened',
          event: 'prOpened',
          defaultCronFromMinutes: 5,
          downstream: 'createTaskFromItem'
        }
      ]
    }
  }
}
