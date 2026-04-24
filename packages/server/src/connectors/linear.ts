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

async function resolveIssueId(apiKey: string, identifier: string): Promise<string | null> {
  const data = await linearGraphQL<{ issues: { nodes: Array<{ id: string }> } }>(
    apiKey,
    `query IssueIdByIdentifier($identifier: String!) {
       issues(filter: { identifier: { eq: $identifier } }, first: 1) { nodes { id } }
     }`,
    { identifier }
  )
  return data.issues.nodes[0]?.id ?? null
}

async function resolveIssueWithTeam(
  apiKey: string,
  identifier: string
): Promise<{ id: string; teamId: string; teamKey: string } | null> {
  const data = await linearGraphQL<{
    issues: { nodes: Array<{ id: string; team: { id: string; key: string } }> }
  }>(
    apiKey,
    `query IssueWithTeam($identifier: String!) {
       issues(filter: { identifier: { eq: $identifier } }, first: 1) {
         nodes { id team { id key } }
       }
     }`,
    { identifier }
  )
  const node = data.issues.nodes[0]
  return node ? { id: node.id, teamId: node.team.id, teamKey: node.team.key } : null
}

async function resolveTeamId(apiKey: string, teamKey: string): Promise<string | null> {
  const data = await linearGraphQL<{ teams: { nodes: Array<{ id: string }> } }>(
    apiKey,
    `query TeamIdByKey($key: String!) {
       teams(filter: { key: { eq: $key } }, first: 1) { nodes { id } }
     }`,
    { key: teamKey }
  )
  return data.teams.nodes[0]?.id ?? null
}

async function resolveCompletedStateId(apiKey: string, teamId: string): Promise<string | null> {
  const data = await linearGraphQL<{
    workflowStates: { nodes: Array<{ id: string; type: string; position: number }> }
  }>(
    apiKey,
    `query CompletedStates($teamId: ID!) {
       workflowStates(
         filter: { team: { id: { eq: $teamId } }, type: { eq: "completed" } }
         first: 5
       ) { nodes { id type position } }
     }`,
    { teamId }
  )
  const nodes = data.workflowStates.nodes
  if (!nodes.length) return null
  // Prefer the lowest-position completed state (Linear orders "Done" before
  // post-done states like "Merged" / "Released").
  return nodes.slice().sort((a, b) => a.position - b.position)[0].id
}

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
  capabilities: ['tasks', 'triggers', 'actions'],

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

  async execute(actionType: string, args: Record<string, unknown>): Promise<ActionResult> {
    const apiKey = requireAuth(args)

    switch (actionType) {
      case 'commentOnIssue': {
        const identifier = typeof args.identifier === 'string' ? args.identifier : ''
        const body = typeof args.body === 'string' ? args.body : ''
        if (!identifier) return { success: false, error: 'identifier is required (e.g. ENG-123)' }
        if (!body) return { success: false, error: 'body is required' }
        const issueId = await resolveIssueId(apiKey, identifier)
        if (!issueId) return { success: false, error: `Issue ${identifier} not found` }
        const data = await linearGraphQL<{
          commentCreate: { success: boolean; comment: { id: string; url: string } }
        }>(
          apiKey,
          `mutation CreateComment($input: CommentCreateInput!) {
             commentCreate(input: $input) { success comment { id url } }
           }`,
          { input: { issueId, body } }
        )
        if (!data.commentCreate.success) {
          return { success: false, error: 'Linear commentCreate returned success=false' }
        }
        return { success: true, output: { url: data.commentCreate.comment.url } }
      }

      case 'createIssue': {
        const title = typeof args.title === 'string' ? args.title : ''
        if (!title) return { success: false, error: 'title is required' }
        const description = typeof args.description === 'string' ? args.description : undefined
        const teamKey = typeof args.teamKey === 'string' ? args.teamKey : undefined
        if (!teamKey) {
          return {
            success: false,
            error: 'teamKey is required (set it on the connection or per-action)'
          }
        }
        const teamId = await resolveTeamId(apiKey, teamKey)
        if (!teamId) return { success: false, error: `Team ${teamKey} not found` }
        const input: Record<string, unknown> = { teamId, title }
        if (description) input.description = description
        const data = await linearGraphQL<{
          issueCreate: {
            success: boolean
            issue: { id: string; identifier: string; url: string }
          }
        }>(
          apiKey,
          `mutation CreateIssue($input: IssueCreateInput!) {
             issueCreate(input: $input) { success issue { id identifier url } }
           }`,
          { input }
        )
        if (!data.issueCreate.success) {
          return { success: false, error: 'Linear issueCreate returned success=false' }
        }
        return {
          success: true,
          output: {
            identifier: data.issueCreate.issue.identifier,
            url: data.issueCreate.issue.url
          }
        }
      }

      case 'closeIssue': {
        const identifier = typeof args.identifier === 'string' ? args.identifier : ''
        if (!identifier) return { success: false, error: 'identifier is required (e.g. ENG-123)' }
        const issue = await resolveIssueWithTeam(apiKey, identifier)
        if (!issue) return { success: false, error: `Issue ${identifier} not found` }
        // Pick a "completed"-type workflow state on the issue's team. Linear
        // doesn't have a single canonical "Done" — each team configures its
        // own, so we grab the first completed-type state.
        const stateId = await resolveCompletedStateId(apiKey, issue.teamId)
        if (!stateId) {
          return { success: false, error: `No completed-type state on team ${issue.teamKey}` }
        }
        const data = await linearGraphQL<{
          issueUpdate: { success: boolean; issue: { id: string; state: { name: string } } }
        }>(
          apiKey,
          `mutation CloseIssue($id: String!, $input: IssueUpdateInput!) {
             issueUpdate(id: $id, input: $input) { success issue { id state { name } } }
           }`,
          { id: issue.id, input: { stateId } }
        )
        if (!data.issueUpdate.success) {
          return { success: false, error: 'Linear issueUpdate returned success=false' }
        }
        return { success: true, output: { state: data.issueUpdate.issue.state.name } }
      }

      case 'syncTasks': {
        // Handled by the sync engine at a higher level; the action node
        // calls listItems() and does upsert logic.
        return { success: true }
      }

      default:
        return { success: false, error: `Unknown action: ${actionType}` }
    }
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
      actions: [
        // teamKey / apiKey come from the connection's filters/auth and are
        // merged server-side before execute() runs, so they're not duplicated
        // in these configFields.
        {
          type: 'commentOnIssue',
          label: 'Comment on Issue',
          description: 'Post a comment on a Linear issue',
          configFields: [
            {
              key: 'identifier',
              label: 'Issue',
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
        },
        {
          type: 'createIssue',
          label: 'Create Issue',
          description: 'Create a new Linear issue',
          configFields: [
            {
              key: 'title',
              label: 'Title',
              type: 'text',
              required: true,
              supportsTemplates: true
            },
            {
              key: 'description',
              label: 'Description',
              type: 'textarea',
              supportsTemplates: true
            },
            {
              key: 'teamKey',
              label: 'Team Key',
              type: 'text',
              placeholder: 'ENG (defaults to connection team)',
              description: 'Override the connection team for this action.'
            }
          ]
        },
        {
          type: 'closeIssue',
          label: 'Close Issue',
          description: "Move an issue to the team's default completed state",
          configFields: [
            {
              key: 'identifier',
              label: 'Issue',
              type: 'text',
              required: true,
              placeholder: '{{connectorItem.externalId}}',
              supportsTemplates: true
            }
          ]
        }
      ],
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
