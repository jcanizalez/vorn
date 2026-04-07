import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'libsql'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { captureAgentSessionId } from '../packages/server/src/agent-session-capture'

// Create temp DBs that mimic each agent's schema

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vg-capture-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function createCopilotDb(sessions: { id: string; cwd: string; updated_at: string }[]): string {
  const dbPath = path.join(tmpDir, '.copilot', 'session-store.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec(`CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT,
    summary TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`)
  const insert = db.prepare('INSERT INTO sessions (id, cwd, updated_at) VALUES (?, ?, ?)')
  for (const s of sessions) insert.run(s.id, s.cwd, s.updated_at)
  db.close()
  return dbPath
}

function createCodexDb(
  threads: { id: string; cwd: string; updated_at: number; archived?: number }[]
): string {
  const dbPath = path.join(tmpDir, '.codex', 'state_5.sqlite')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec(`CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    rollout_path TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT '',
    model_provider TEXT NOT NULL DEFAULT '',
    sandbox_policy TEXT NOT NULL DEFAULT '',
    approval_mode TEXT NOT NULL DEFAULT '',
    first_user_message TEXT NOT NULL DEFAULT '',
    cli_version TEXT NOT NULL DEFAULT ''
  )`)
  const insert = db.prepare(
    'INSERT INTO threads (id, cwd, updated_at, archived) VALUES (?, ?, ?, ?)'
  )
  for (const t of threads) insert.run(t.id, t.cwd, t.updated_at, t.archived ?? 0)
  db.close()
  return dbPath
}

function createOpenCodeDb(
  sessions: { id: string; directory: string; time_updated: number; time_archived?: number | null }[]
): string {
  const dbPath = path.join(tmpDir, 'opencode', 'opencode.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec(`CREATE TABLE session (
    id TEXT PRIMARY KEY,
    directory TEXT,
    title TEXT,
    time_updated INTEGER,
    time_archived INTEGER
  )`)
  const insert = db.prepare(
    'INSERT INTO session (id, directory, time_updated, time_archived) VALUES (?, ?, ?, ?)'
  )
  for (const s of sessions) insert.run(s.id, s.directory, s.time_updated, s.time_archived ?? null)
  db.close()
  return dbPath
}

// We can't easily override the DB paths used by captureAgentSessionId since
// they're hardcoded to ~/.copilot etc. Instead, test the real function against
// whatever exists on the machine, and test the edge cases via the DB directly.

describe('captureAgentSessionId', () => {
  it('returns undefined for unsupported agent types', () => {
    expect(captureAgentSessionId('claude', '/any/path')).toBeUndefined()
    expect(captureAgentSessionId('gemini', '/any/path')).toBeUndefined()
  })

  it('returns undefined for non-existent paths', () => {
    expect(captureAgentSessionId('copilot', '/this/path/does/not/exist')).toBeUndefined()
    expect(captureAgentSessionId('codex', '/this/path/does/not/exist')).toBeUndefined()
  })

  it('returns undefined gracefully when agent DB does not exist', () => {
    // opencode DB typically doesn't exist on dev machines
    const opencodePath =
      process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA || '', 'opencode', 'opencode.db')
        : path.join(
            process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
            'opencode',
            'opencode.db'
          )
    if (!fs.existsSync(opencodePath)) {
      expect(captureAgentSessionId('opencode', '/any/path')).toBeUndefined()
    }
  })
})

describe('copilot DB schema', () => {
  it('reads most recent session by cwd from a copilot-format DB', () => {
    const dbPath = createCopilotDb([
      { id: 'old-session', cwd: '/my/project', updated_at: '2026-01-01T00:00:00Z' },
      { id: 'new-session', cwd: '/my/project', updated_at: '2026-04-01T00:00:00Z' },
      { id: 'other-project', cwd: '/other/path', updated_at: '2026-04-02T00:00:00Z' }
    ])
    const db = new Database(dbPath, { readonly: true })
    const row = db
      .prepare(
        `SELECT id FROM sessions WHERE lower(replace(cwd, '\\', '/')) = ? ORDER BY updated_at DESC LIMIT 1`
      )
      .get('/my/project') as { id: string } | undefined
    db.close()
    expect(row?.id).toBe('new-session')
  })

  it('handles Windows backslash paths', () => {
    const dbPath = createCopilotDb([
      {
        id: 'win-session',
        cwd: 'C:\\Users\\dev\\project',
        updated_at: '2026-04-01T00:00:00Z'
      }
    ])
    const db = new Database(dbPath, { readonly: true })
    const row = db
      .prepare(
        `SELECT id FROM sessions WHERE lower(replace(cwd, '\\', '/')) = ? ORDER BY updated_at DESC LIMIT 1`
      )
      .get('c:/users/dev/project') as { id: string } | undefined
    db.close()
    expect(row?.id).toBe('win-session')
  })
})

describe('codex DB schema', () => {
  it('reads most recent non-archived thread by cwd', () => {
    const dbPath = createCodexDb([
      { id: 'archived-thread', cwd: '/my/project', updated_at: 9999999, archived: 1 },
      { id: 'old-thread', cwd: '/my/project', updated_at: 1000000 },
      { id: 'new-thread', cwd: '/my/project', updated_at: 2000000 }
    ])
    const db = new Database(dbPath, { readonly: true })
    const row = db
      .prepare(
        `SELECT id FROM threads WHERE archived = 0 AND lower(replace(cwd, '\\', '/')) = ? ORDER BY updated_at DESC LIMIT 1`
      )
      .get('/my/project') as { id: string } | undefined
    db.close()
    expect(row?.id).toBe('new-thread')
  })
})

describe('opencode DB schema', () => {
  it('reads most recent non-archived session by directory', () => {
    const dbPath = createOpenCodeDb([
      { id: 'archived', directory: '/my/project', time_updated: 9999, time_archived: 8888 },
      { id: 'active', directory: '/my/project', time_updated: 5000, time_archived: null }
    ])
    const db = new Database(dbPath, { readonly: true })
    const row = db
      .prepare(
        `SELECT id FROM session WHERE time_archived IS NULL AND lower(replace(directory, '\\', '/')) = ? ORDER BY time_updated DESC LIMIT 1`
      )
      .get('/my/project') as { id: string } | undefined
    db.close()
    expect(row?.id).toBe('active')
  })
})
