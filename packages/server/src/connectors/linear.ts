import type {
  VornConnector,
  ExternalItem,
  PollResult,
  ActionResult,
  ConnectorManifest,
  TaskStatus
} from '@vornrun/shared/types'
import log from '../logger'

const LINEAR_API = 'https://api.linear.app/graphql'

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description: string | null
  url: string
  createdAt: string
  updatedAt: string
  state: { name: string; type: string }
  labels: { nodes: Array<{ name: string }> }
  assignee: { name: string } | null
  team: { key: string }
}

async function linearGraphQL<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Linear API ${res.status}: ${body.slice(0, 200)}`)
  }
  const payload = (await res.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (payload.errors?.length) {
    throw new Error(`Linear GraphQL error: ${payload.errors.map((e) => e.message).join('; ')}`)
  }
  if (!payload.data) throw new Error('Linear API returned no data')
  return payload.data
}

function issueToExternalItem(issue: LinearIssue): ExternalItem {
  return {
    externalId: issue.identifier,
    url: issue.url,
    title: issue.title,
    description: issue.description ?? '',
    status: issue.state.type,
    labels: issue.labels.nodes.map((l) => l.name),
    ...(issue.assignee?.name && { assignee: issue.assignee.name }),
    updatedAt: issue.updatedAt,
    metadata: { createdAt: issue.createdAt, stateName: issue.state.name }
  }
}

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  url
  createdAt
  updatedAt
  state { name type }
  labels { nodes { name } }
  assignee { name }
  team { key }
`

function requireAuth(filters: Record<string, unknown>): string {
  const key = filters.apiKey
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error(
      'Linear API key is required. Create one at https://linear.app/settings/api and paste into the connection.'
    )
  }
  return key
}

export const linearConnector: VornConnector = {
  id: 'linear',
  name: 'Linear',
  icon: 'linear',
  capabilities: ['tasks', 'triggers'],

  async listItems(filters: Record<string, unknown>): Promise<ExternalItem[]> {
    const apiKey = requireAuth(filters)
    const teamKey = typeof filters.teamKey === 'string' ? filters.teamKey : undefined
    const stateType = typeof filters.stateType === 'string' ? filters.stateType : undefined
    const limit = Number(filters.limit ?? 50)

    const filter: Record<string, unknown> = {}
    if (teamKey) filter.team = { key: { eq: teamKey } }
    if (stateType) filter.state = { type: { eq: stateType } }

    const query = `
      query ListIssues($filter: IssueFilter, $first: Int!) {
        issues(filter: $filter, first: $first, orderBy: updatedAt) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `
    const data = await linearGraphQL<{ issues: { nodes: LinearIssue[] } }>(apiKey, query, {
      filter: Object.keys(filter).length ? filter : undefined,
      first: limit
    })
    return data.issues.nodes.map(issueToExternalItem)
  },

  async getItem(
    externalId: string,
    filters: Record<string, unknown>
  ): Promise<ExternalItem | null> {
    const apiKey = requireAuth(filters)
    // externalId is the human identifier (e.g. "ENG-123"), not the UUID,
    // so filter by identifier rather than using the id-by-uuid query.
    const query = `
      query GetIssueByIdentifier($identifier: String!) {
        issues(filter: { identifier: { eq: $identifier } }, first: 1) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `
    try {
      const data = await linearGraphQL<{ issues: { nodes: LinearIssue[] } }>(apiKey, query, {
        identifier: externalId
      })
      const issue = data.issues.nodes[0]
      return issue ? issueToExternalItem(issue) : null
    } catch (err) {
      log.warn(`[linear-connector] getItem failed: ${err}`)
      return null
    }
  },

  async poll(
    triggerType: string,
    config: Record<string, unknown>,
    cursor?: string
  ): Promise<PollResult> {
    const apiKey = requireAuth(config)
    const teamKey = typeof config.teamKey === 'string' ? config.teamKey : undefined
    const since = cursor || new Date(Date.now() - 60_000).toISOString()
    const PAGE_SIZE = 30

    if (triggerType !== 'issueCreated') return { events: [] }

    const filter: Record<string, unknown> = { createdAt: { gt: since } }
    if (teamKey) filter.team = { key: { eq: teamKey } }
    const query = `
      query PollIssues($filter: IssueFilter!, $first: Int!) {
        issues(filter: $filter, first: $first, orderBy: createdAt) {
          nodes { ${ISSUE_FIELDS} }
        }
      }
    `
    const data = await linearGraphQL<{ issues: { nodes: LinearIssue[] } }>(apiKey, query, {
      filter,
      first: PAGE_SIZE
    })
    const items = data.issues.nodes
    // When we hit the page cap the tail may have been truncated — advance
    // only to the oldest item we actually saw so older items stuck beyond
    // the page boundary get picked up on the next poll. `orderBy: createdAt`
    // returns newest-first in Linear; items[items.length-1] is the oldest.
    const nextCursor =
      items.length >= PAGE_SIZE && items.length > 0
        ? items[items.length - 1].createdAt
        : new Date().toISOString()
    return {
      events: items.map((i) => ({
        id: i.identifier,
        type: 'issueCreated',
        data: issueToExternalItem(i) as unknown as Record<string, unknown>,
        timestamp: i.createdAt
      })),
      nextCursor
    }
  },

  async execute(actionType: string, _args: Record<string, unknown>): Promise<ActionResult> {
    // Linear actions (createIssue, updateIssue) not yet implemented — the
    // connector is read-only for polling tasks into the board.
    return { success: false, error: `Linear action "${actionType}" not implemented yet` }
  },

  describe(): ConnectorManifest {
    return {
      auth: [
        {
          key: 'apiKey',
          label: 'Linear API Key',
          type: 'password',
          required: true,
          description: 'Create at linear.app/settings/api (personal API key).'
        }
      ],
      taskFilters: [
        {
          key: 'teamKey',
          label: 'Team Key',
          type: 'text',
          placeholder: 'ENG',
          description: 'Upper-case team key (leave blank to pull all teams).'
        },
        {
          key: 'stateType',
          label: 'State',
          type: 'select',
          options: [
            { value: '', label: 'All' },
            { value: 'unstarted', label: 'Backlog / Unstarted' },
            { value: 'started', label: 'In Progress' },
            { value: 'completed', label: 'Done' },
            { value: 'canceled', label: 'Canceled' }
          ]
        }
      ],
      statusMapping: [
        { upstream: 'backlog', suggestedLocal: 'todo' as TaskStatus },
        { upstream: 'unstarted', suggestedLocal: 'todo' as TaskStatus },
        { upstream: 'started', suggestedLocal: 'in_progress' as TaskStatus },
        { upstream: 'completed', suggestedLocal: 'done' as TaskStatus },
        { upstream: 'canceled', suggestedLocal: 'cancelled' as TaskStatus }
      ],
      triggers: [
        {
          type: 'issueCreated',
          label: 'Issue Created',
          description: 'Fires when a new Linear issue is created',
          configFields: [],
          defaultIntervalMs: 60_000
        }
      ],
      actions: [],
      defaultWorkflows: [
        {
          name: 'Linear: Issue Created',
          event: 'issueCreated',
          defaultCronFromMinutes: 5,
          downstream: 'createTaskFromItem'
        }
      ]
    }
  }
}
