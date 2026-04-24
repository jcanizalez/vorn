import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  // @ts-expect-error — node globalThis.fetch
  globalThis.fetch = fetchMock
})

function issueNode(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'uuid-1',
    identifier: 'ENG-1',
    title: 'Hello',
    description: 'Desc',
    url: 'https://linear.app/team/issue/ENG-1',
    createdAt: '2026-04-24T10:00:00Z',
    updatedAt: '2026-04-24T10:00:00Z',
    state: { name: 'Todo', type: 'unstarted' },
    labels: { nodes: [{ name: 'bug' }] },
    assignee: { name: 'alice' },
    team: { key: 'ENG' },
    ...overrides
  }
}

function okResponse(data: unknown): Response {
  return new Response(JSON.stringify({ data }), { status: 200 })
}

const importLinear = async () =>
  (await import('../packages/server/src/connectors/linear')).linearConnector

describe('linear connector — describe()', () => {
  it('advertises tasks, triggers, and actions', async () => {
    const linear = await importLinear()
    expect(linear.capabilities).toEqual(['tasks', 'triggers', 'actions'])
  })

  it('declares commentOnIssue / createIssue / closeIssue actions', async () => {
    const linear = await importLinear()
    const manifest = linear.describe()
    const types = manifest.actions?.map((a) => a.type)
    expect(types).toEqual(['commentOnIssue', 'createIssue', 'closeIssue'])
  })

  it('declares apiKey as a required password auth field', async () => {
    const linear = await importLinear()
    const manifest = linear.describe()
    const apiKey = manifest.auth.find((f) => f.key === 'apiKey')
    expect(apiKey?.type).toBe('password')
    expect(apiKey?.required).toBe(true)
  })

  it('declares issueCreated trigger + status mapping for Linear state types', async () => {
    const linear = await importLinear()
    const manifest = linear.describe()
    expect(manifest.triggers?.map((t) => t.type)).toEqual(['issueCreated'])
    expect(manifest.statusMapping?.map((s) => s.upstream)).toContain('started')
  })
})

describe('linear connector — auth + error handling', () => {
  it('throws a helpful error when apiKey is missing', async () => {
    const linear = await importLinear()
    await expect(linear.listItems!({})).rejects.toThrow(/Linear API key is required/)
  })

  it('bubbles up GraphQL errors from the response body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'bad query' }] }), { status: 200 })
    )
    const linear = await importLinear()
    await expect(linear.listItems!({ apiKey: 'k' })).rejects.toThrow(/bad query/)
  })

  it('bubbles up HTTP errors with status code', async () => {
    fetchMock.mockResolvedValue(new Response('server melted', { status: 503 }))
    const linear = await importLinear()
    await expect(linear.listItems!({ apiKey: 'k' })).rejects.toThrow(/503/)
  })
})

describe('linear connector — listItems()', () => {
  it('uses GraphQL variables (no string-interpolated filter)', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [issueNode()] } }))
    const linear = await importLinear()
    await linear.listItems!({ apiKey: 'k', teamKey: 'ENG', stateType: 'unstarted' })
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    // Variables carry the filter object rather than being string-interpolated.
    expect(body.variables.filter).toEqual({
      team: { key: { eq: 'ENG' } },
      state: { type: { eq: 'unstarted' } }
    })
    expect(body.query).toContain('$filter: IssueFilter')
    expect(body.query).toContain('$first: Int!')
  })

  it('maps a Linear issue to an ExternalItem with identifier as externalId', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [issueNode()] } }))
    const linear = await importLinear()
    const items = await linear.listItems!({ apiKey: 'k' })
    expect(items[0]).toMatchObject({
      externalId: 'ENG-1',
      title: 'Hello',
      status: 'unstarted',
      assignee: 'alice',
      labels: ['bug']
    })
  })

  it('sends Authorization header with the api key', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [] } }))
    const linear = await importLinear()
    await linear.listItems!({ apiKey: 'secret-key' })
    const [, init] = fetchMock.mock.calls[0]
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('secret-key')
  })
})

describe('linear connector — getItem()', () => {
  it('queries by identifier filter (not by uuid id)', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [issueNode()] } }))
    const linear = await importLinear()
    const item = await linear.getItem!('ENG-1', { apiKey: 'k' })
    expect(item?.externalId).toBe('ENG-1')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.query).toContain('issues(filter: { identifier: { eq: $identifier }')
    expect(body.variables.identifier).toBe('ENG-1')
  })

  it('returns null when no issue matches', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [] } }))
    const linear = await importLinear()
    expect(await linear.getItem!('ENG-999', { apiKey: 'k' })).toBeNull()
  })

  it('returns null on error (doesn t throw)', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))
    const linear = await importLinear()
    expect(await linear.getItem!('ENG-1', { apiKey: 'k' })).toBeNull()
  })
})

describe('linear connector — poll()', () => {
  it('returns empty for unknown trigger types', async () => {
    const linear = await importLinear()
    const result = await linear.poll!('prOpened', { apiKey: 'k' })
    expect(result.events).toEqual([])
  })

  it('uses since cursor as the createdAt GT filter', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [issueNode()] } }))
    const linear = await importLinear()
    await linear.poll!('issueCreated', { apiKey: 'k', teamKey: 'ENG' }, '2026-04-24T09:00:00Z')
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.variables.filter.createdAt).toEqual({ gt: '2026-04-24T09:00:00Z' })
    expect(body.variables.filter.team).toEqual({ key: { eq: 'ENG' } })
  })

  it('advances cursor to now when under the page cap', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [issueNode()] } }))
    const linear = await importLinear()
    const result = await linear.poll!('issueCreated', { apiKey: 'k' })
    expect(result.events).toHaveLength(1)
    expect(result.nextCursor).toBeDefined()
    expect(result.nextCursor).not.toBe(issueNode().createdAt)
  })

  it('advances cursor only to the oldest seen item when page cap fills', async () => {
    // 30 items in descending order so the last item is the oldest.
    const items = Array.from({ length: 30 }, (_, i) =>
      issueNode({
        identifier: `ENG-${30 - i}`,
        createdAt: `2026-04-24T10:${String(30 - i).padStart(2, '0')}:00Z`
      })
    )
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: items } }))
    const linear = await importLinear()
    const result = await linear.poll!('issueCreated', { apiKey: 'k' })
    expect(result.nextCursor).toBe('2026-04-24T10:01:00Z')
  })
})

describe('linear connector — execute()', () => {
  it('createIssue: resolves teamKey to teamId then calls issueCreate', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ teams: { nodes: [{ id: 'team-uuid' }] } }))
      .mockResolvedValueOnce(
        okResponse({
          issueCreate: {
            success: true,
            issue: { id: 'i', identifier: 'ENG-42', url: 'https://linear.app/i/ENG-42' }
          }
        })
      )
    const linear = await importLinear()
    const result = await linear.execute!('createIssue', {
      apiKey: 'k',
      teamKey: 'ENG',
      title: 'New bug',
      description: 'desc'
    })
    expect(result.success).toBe(true)
    expect(result.output).toEqual({
      identifier: 'ENG-42',
      url: 'https://linear.app/i/ENG-42'
    })
    const createBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(createBody.variables.input).toEqual({
      teamId: 'team-uuid',
      title: 'New bug',
      description: 'desc'
    })
  })

  it('createIssue: fails when title is missing', async () => {
    const linear = await importLinear()
    const result = await linear.execute!('createIssue', { apiKey: 'k', teamKey: 'ENG' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/title is required/)
  })

  it('createIssue: fails when teamKey is missing (not on connection or call)', async () => {
    const linear = await importLinear()
    const result = await linear.execute!('createIssue', { apiKey: 'k', title: 't' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/teamKey is required/)
  })

  it('commentOnIssue: resolves identifier to UUID then calls commentCreate', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ issues: { nodes: [{ id: 'issue-uuid' }] } }))
      .mockResolvedValueOnce(
        okResponse({
          commentCreate: { success: true, comment: { id: 'c', url: 'https://linear.app/c/1' } }
        })
      )
    const linear = await importLinear()
    const result = await linear.execute!('commentOnIssue', {
      apiKey: 'k',
      identifier: 'ENG-1',
      body: 'thanks'
    })
    expect(result.success).toBe(true)
    const commentBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(commentBody.variables.input).toEqual({ issueId: 'issue-uuid', body: 'thanks' })
  })

  it('commentOnIssue: fails when issue identifier not found', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [] } }))
    const linear = await importLinear()
    const result = await linear.execute!('commentOnIssue', {
      apiKey: 'k',
      identifier: 'ENG-999',
      body: 'hi'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/)
  })

  it('closeIssue: picks lowest-position completed state on the issue team', async () => {
    fetchMock
      .mockResolvedValueOnce(
        okResponse({
          issues: {
            nodes: [{ id: 'issue-uuid', team: { id: 'team-uuid', key: 'ENG' } }]
          }
        })
      )
      .mockResolvedValueOnce(
        okResponse({
          workflowStates: {
            nodes: [
              { id: 'state-released', type: 'completed', position: 200 },
              { id: 'state-done', type: 'completed', position: 100 }
            ]
          }
        })
      )
      .mockResolvedValueOnce(
        okResponse({
          issueUpdate: { success: true, issue: { id: 'issue-uuid', state: { name: 'Done' } } }
        })
      )
    const linear = await importLinear()
    const result = await linear.execute!('closeIssue', {
      apiKey: 'k',
      identifier: 'ENG-1'
    })
    expect(result.success).toBe(true)
    const updateBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)
    expect(updateBody.variables.id).toBe('issue-uuid')
    expect(updateBody.variables.input).toEqual({ stateId: 'state-done' })
  })

  it('returns an error for unknown action types', async () => {
    const linear = await importLinear()
    const result = await linear.execute!('noSuchAction', { apiKey: 'k' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Unknown action/)
  })

  it('commentOnIssue: surfaces success:false from Linear', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ issues: { nodes: [{ id: 'issue-uuid' }] } }))
      .mockResolvedValueOnce(okResponse({ commentCreate: { success: false, comment: null } }))
    const linear = await importLinear()
    const result = await linear.execute!('commentOnIssue', {
      apiKey: 'k',
      identifier: 'ENG-1',
      body: 'hi'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/success=false/)
  })

  it('createIssue: fails when teamKey has no matching team', async () => {
    fetchMock.mockResolvedValue(okResponse({ teams: { nodes: [] } }))
    const linear = await importLinear()
    const result = await linear.execute!('createIssue', {
      apiKey: 'k',
      teamKey: 'NOPE',
      title: 't'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Team NOPE not found/)
  })

  it('createIssue: surfaces success:false from Linear', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ teams: { nodes: [{ id: 'team-uuid' }] } }))
      .mockResolvedValueOnce(okResponse({ issueCreate: { success: false, issue: null } }))
    const linear = await importLinear()
    const result = await linear.execute!('createIssue', {
      apiKey: 'k',
      teamKey: 'ENG',
      title: 't'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/success=false/)
  })

  it('closeIssue: fails when the team has no completed-type workflow state', async () => {
    fetchMock
      .mockResolvedValueOnce(
        okResponse({
          issues: { nodes: [{ id: 'issue-uuid', team: { id: 'team-uuid', key: 'ENG' } }] }
        })
      )
      .mockResolvedValueOnce(okResponse({ workflowStates: { nodes: [] } }))
    const linear = await importLinear()
    const result = await linear.execute!('closeIssue', {
      apiKey: 'k',
      identifier: 'ENG-1'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/No completed-type state/)
  })

  it('closeIssue: fails when identifier not found', async () => {
    fetchMock.mockResolvedValue(okResponse({ issues: { nodes: [] } }))
    const linear = await importLinear()
    const result = await linear.execute!('closeIssue', {
      apiKey: 'k',
      identifier: 'ENG-999'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/)
  })

  it('commentOnIssue: fails when body is missing', async () => {
    const linear = await importLinear()
    const result = await linear.execute!('commentOnIssue', {
      apiKey: 'k',
      identifier: 'ENG-1'
    })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/body is required/)
  })
})
