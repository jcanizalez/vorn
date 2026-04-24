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
  dbListSourceConnections,
  dbGetSourceConnection,
  dbInsertSourceConnection,
  dbUpdateSourceConnection,
  dbDeleteSourceConnection,
  dbInsertTask,
  dbInsertTaskSourceLink,
  dbListTaskSourceLinks,
  dbGetTaskSourceLink,
  dbUpdateTaskSourceLink,
  dbDeleteTaskSourceLink
} from '../packages/server/src/database'
import type { SourceConnection, TaskConfig } from '../packages/shared/src/types'

let teardown: () => void

beforeEach(() => {
  teardown = initTestDatabase()
})

afterEach(() => {
  teardown()
})

function makeConn(overrides: Partial<SourceConnection> = {}): SourceConnection {
  return {
    id: 'conn-a',
    connectorId: 'github',
    name: 'owner/repo',
    filters: { owner: 'o', repo: 'r' },
    syncIntervalMinutes: 5,
    statusMapping: { open: 'todo', closed: 'done' },
    createdAt: '2026-04-24T00:00:00Z',
    ...overrides
  }
}

function makeTask(id: string): TaskConfig {
  return {
    id,
    projectName: 'p',
    title: 't',
    description: '',
    status: 'todo',
    order: 0,
    createdAt: '2026-04-24T00:00:00Z',
    updatedAt: '2026-04-24T00:00:00Z'
  }
}

describe('source_connections CRUD', () => {
  it('list returns [] initially', () => {
    expect(dbListSourceConnections()).toEqual([])
  })

  it('insert + get round-trips all fields including optional ones', () => {
    const conn = makeConn({
      id: 'conn-1',
      executionProject: 'my-proj',
      lastSyncAt: '2026-04-24T01:00:00Z',
      lastSyncError: 'boom',
      syncCursor: '2026-04-24T00:59:00Z'
    })
    dbInsertSourceConnection(conn)
    const fetched = dbGetSourceConnection('conn-1')!
    expect(fetched).toEqual(conn)
  })

  it('filters / statusMapping serialize as JSON and deserialize correctly', () => {
    dbInsertSourceConnection(
      makeConn({ filters: { owner: 'oct', labels: 'bug,fix' }, statusMapping: { foo: 'todo' } })
    )
    const fetched = dbGetSourceConnection('conn-a')!
    expect(fetched.filters).toEqual({ owner: 'oct', labels: 'bug,fix' })
    expect(fetched.statusMapping).toEqual({ foo: 'todo' })
  })

  it('list filters by connectorId when provided', () => {
    dbInsertSourceConnection(makeConn({ id: 'gh-1', connectorId: 'github' }))
    dbInsertSourceConnection(makeConn({ id: 'lin-1', connectorId: 'linear' }))
    expect(dbListSourceConnections('github').map((c) => c.id)).toEqual(['gh-1'])
    expect(dbListSourceConnections('linear').map((c) => c.id)).toEqual(['lin-1'])
    expect(dbListSourceConnections().length).toBe(2)
  })

  it('get returns null for missing id', () => {
    expect(dbGetSourceConnection('nope')).toBeNull()
  })

  it('update sets only the provided fields', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbUpdateSourceConnection('conn-1', { name: 'renamed' })
    expect(dbGetSourceConnection('conn-1')!.name).toBe('renamed')
    // other fields unchanged
    expect(dbGetSourceConnection('conn-1')!.connectorId).toBe('github')
  })

  it('update clears lastSyncError when explicitly set to undefined', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1', lastSyncError: 'oops' }))
    dbUpdateSourceConnection('conn-1', { lastSyncError: undefined })
    expect(dbGetSourceConnection('conn-1')!.lastSyncError).toBeUndefined()
  })

  it('update advances syncCursor in-place', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbUpdateSourceConnection('conn-1', { syncCursor: '2026-04-24T10:00:00Z' })
    expect(dbGetSourceConnection('conn-1')!.syncCursor).toBe('2026-04-24T10:00:00Z')
  })

  it('update is a no-op when no fields are provided', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    const before = dbGetSourceConnection('conn-1')
    dbUpdateSourceConnection('conn-1', {})
    expect(dbGetSourceConnection('conn-1')).toEqual(before)
  })

  it('update persists filters JSON changes', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbUpdateSourceConnection('conn-1', { filters: { owner: 'new' } })
    expect(dbGetSourceConnection('conn-1')!.filters).toEqual({ owner: 'new' })
  })

  it('update persists statusMapping JSON changes', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbUpdateSourceConnection('conn-1', { statusMapping: { a: 'in_progress' } })
    expect(dbGetSourceConnection('conn-1')!.statusMapping).toEqual({ a: 'in_progress' })
  })

  it('update persists syncIntervalMinutes + executionProject changes', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbUpdateSourceConnection('conn-1', { syncIntervalMinutes: 15, executionProject: 'proj-b' })
    const got = dbGetSourceConnection('conn-1')!
    expect(got.syncIntervalMinutes).toBe(15)
    expect(got.executionProject).toBe('proj-b')
  })

  it('delete removes the connection', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbDeleteSourceConnection('conn-1')
    expect(dbGetSourceConnection('conn-1')).toBeNull()
  })

  it('delete cascades to task_source_links via FK', () => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbInsertTask(makeTask('task-1'))
    dbInsertTaskSourceLink({
      taskId: 'task-1',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '7',
      externalUrl: 'u',
      sourceStatusRaw: 'open',
      sourceUpdatedAt: '2026-04-24T00:00:00Z',
      lastSyncedAt: '2026-04-24T00:00:00Z',
      conflictState: 'none'
    })
    expect(dbListTaskSourceLinks('conn-1')).toHaveLength(1)
    dbDeleteSourceConnection('conn-1')
    expect(dbListTaskSourceLinks('conn-1')).toEqual([])
  })
})

describe('task_source_links CRUD', () => {
  beforeEach(() => {
    dbInsertSourceConnection(makeConn({ id: 'conn-1' }))
    dbInsertTask(makeTask('task-1'))
  })

  it('round-trips an inserted link', () => {
    dbInsertTaskSourceLink({
      taskId: 'task-1',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '42',
      externalUrl: 'https://u/42',
      sourceStatusRaw: 'open',
      sourceUpdatedAt: '2026-04-24T00:00:00Z',
      lastSyncedAt: '2026-04-24T00:00:00Z',
      conflictState: 'none'
    })
    expect(dbGetTaskSourceLink('task-1')).toMatchObject({
      taskId: 'task-1',
      externalId: '42',
      externalUrl: 'https://u/42',
      conflictState: 'none'
    })
  })

  it('update patches only the specified fields', () => {
    dbInsertTaskSourceLink({
      taskId: 'task-1',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '42',
      externalUrl: 'u',
      sourceStatusRaw: 'open',
      sourceUpdatedAt: '2026-04-24T00:00:00Z',
      lastSyncedAt: '2026-04-24T00:00:00Z',
      conflictState: 'none'
    })
    dbUpdateTaskSourceLink('task-1', { sourceStatusRaw: 'closed', lastSyncedAt: 'later' })
    const link = dbGetTaskSourceLink('task-1')!
    expect(link.sourceStatusRaw).toBe('closed')
    expect(link.lastSyncedAt).toBe('later')
    expect(link.externalId).toBe('42') // untouched
  })

  it('update is a no-op when nothing to change', () => {
    dbInsertTaskSourceLink({
      taskId: 'task-1',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '42',
      externalUrl: 'u',
      sourceStatusRaw: 'open',
      sourceUpdatedAt: '2026-04-24T00:00:00Z',
      lastSyncedAt: '2026-04-24T00:00:00Z',
      conflictState: 'none'
    })
    const before = dbGetTaskSourceLink('task-1')
    dbUpdateTaskSourceLink('task-1', {})
    expect(dbGetTaskSourceLink('task-1')).toEqual(before)
  })

  it('delete removes a single link', () => {
    dbInsertTaskSourceLink({
      taskId: 'task-1',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '42',
      externalUrl: 'u',
      sourceStatusRaw: 'open',
      sourceUpdatedAt: '2026-04-24T00:00:00Z',
      lastSyncedAt: '2026-04-24T00:00:00Z',
      conflictState: 'none'
    })
    dbDeleteTaskSourceLink('task-1')
    expect(dbGetTaskSourceLink('task-1')).toBeNull()
  })

  it('list returns all links for a connection', () => {
    dbInsertTask(makeTask('task-2'))
    dbInsertTaskSourceLink({
      taskId: 'task-1',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '1',
      externalUrl: 'u1',
      sourceStatusRaw: '',
      sourceUpdatedAt: '',
      lastSyncedAt: '',
      conflictState: 'none'
    })
    dbInsertTaskSourceLink({
      taskId: 'task-2',
      connectionId: 'conn-1',
      connectorId: 'github',
      externalId: '2',
      externalUrl: 'u2',
      sourceStatusRaw: '',
      sourceUpdatedAt: '',
      lastSyncedAt: '',
      conflictState: 'none'
    })
    expect(dbListTaskSourceLinks('conn-1')).toHaveLength(2)
  })
})
