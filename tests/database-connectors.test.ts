import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, existsSync: vi.fn(() => true), mkdirSync: vi.fn() }
})

import {
  initTestDatabase,
  dbInsertWorkflow,
  dbGetWorkflow,
  dbInsertTask,
  dbInsertSourceConnection,
  dbInsertTaskSourceLink,
  dbFindTaskByConnectorExternalId,
  dbGetTaskSourceLinkByExternalId
} from '../packages/server/src/database'
import type { WorkflowDefinition, TaskConfig, SourceConnection } from '../packages/shared/src/types'

let teardown: () => void

beforeEach(() => {
  teardown = initTestDatabase()
})

afterEach(() => {
  teardown()
})

function makeWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'wf-test',
    name: 'Test',
    icon: 'Zap',
    iconColor: '#fff',
    nodes: [],
    edges: [],
    enabled: true,
    workspaceId: 'personal',
    ...overrides
  }
}

function makeTask(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    id: 'task-test',
    projectName: 'proj',
    title: 'Test task',
    description: '',
    status: 'todo',
    order: 0,
    createdAt: '2026-04-24T00:00:00Z',
    updatedAt: '2026-04-24T00:00:00Z',
    ...overrides
  }
}

function makeConn(overrides: Partial<SourceConnection> = {}): SourceConnection {
  return {
    id: 'conn-test',
    connectorId: 'github',
    name: 'owner/repo',
    filters: {},
    syncIntervalMinutes: 5,
    statusMapping: {},
    createdAt: '2026-04-24T00:00:00Z',
    ...overrides
  }
}

describe('dbGetWorkflow', () => {
  it('returns null for a non-existent id', () => {
    expect(dbGetWorkflow('does-not-exist')).toBeNull()
  })

  it('round-trips an inserted workflow', () => {
    const wf = makeWorkflow({
      id: 'wf-round-trip',
      name: 'Round-tripped',
      iconColor: '#abc',
      staggerDelayMs: 250
    })
    dbInsertWorkflow(wf)
    const loaded = dbGetWorkflow('wf-round-trip')
    expect(loaded).not.toBeNull()
    expect(loaded?.name).toBe('Round-tripped')
    expect(loaded?.iconColor).toBe('#abc')
    expect(loaded?.staggerDelayMs).toBe(250)
  })

  it('preserves the enabled flag across fetch', () => {
    dbInsertWorkflow(makeWorkflow({ id: 'wf-disabled', enabled: false }))
    expect(dbGetWorkflow('wf-disabled')?.enabled).toBe(false)
  })
})

describe('dbFindTaskByConnectorExternalId', () => {
  it('returns null when no task has the given source fields', () => {
    expect(dbFindTaskByConnectorExternalId('github', '999')).toBeNull()
  })

  it('finds a task by (connectorId, externalId) even without a link row', () => {
    dbInsertTask(
      makeTask({
        id: 'task-orphan',
        sourceConnectorId: 'github',
        sourceExternalId: '42'
      })
    )
    const found = dbFindTaskByConnectorExternalId('github', '42')
    expect(found?.id).toBe('task-orphan')
    expect(found?.sourceExternalId).toBe('42')
  })

  it('does not match a different connector id', () => {
    dbInsertTask(
      makeTask({
        id: 'task-linear',
        sourceConnectorId: 'linear',
        sourceExternalId: '42'
      })
    )
    expect(dbFindTaskByConnectorExternalId('github', '42')).toBeNull()
  })

  it('does not match a different external id', () => {
    dbInsertTask(
      makeTask({
        id: 'task-different',
        sourceConnectorId: 'github',
        sourceExternalId: '1'
      })
    )
    expect(dbFindTaskByConnectorExternalId('github', '2')).toBeNull()
  })

  it('returns the first match when multiple tasks share the same source (edge case)', () => {
    dbInsertTask(makeTask({ id: 'first', sourceConnectorId: 'github', sourceExternalId: '5' }))
    dbInsertTask(makeTask({ id: 'second', sourceConnectorId: 'github', sourceExternalId: '5' }))
    const found = dbFindTaskByConnectorExternalId('github', '5')
    expect(['first', 'second']).toContain(found?.id)
  })
})

describe('dbGetTaskSourceLinkByExternalId', () => {
  it('returns null for missing link', () => {
    expect(dbGetTaskSourceLinkByExternalId('conn-test', '1')).toBeNull()
  })

  it('fetches a link by (connectionId, externalId)', () => {
    dbInsertSourceConnection(makeConn())
    dbInsertTask(makeTask({ id: 'task-linked' }))
    dbInsertTaskSourceLink({
      taskId: 'task-linked',
      connectionId: 'conn-test',
      connectorId: 'github',
      externalId: '7',
      externalUrl: 'u',
      sourceStatusRaw: 'open',
      sourceUpdatedAt: '2026-04-24T00:00:00Z',
      lastSyncedAt: '2026-04-24T00:00:00Z',
      conflictState: 'none'
    })
    const link = dbGetTaskSourceLinkByExternalId('conn-test', '7')
    expect(link?.taskId).toBe('task-linked')
  })
})
