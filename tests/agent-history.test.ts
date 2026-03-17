import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ mtimeMs: 0 }))
  }
}))
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '')
}))

import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { getRecentSessions } from '../packages/server/src/agent-history'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRecentSessions', () => {
  it('returns empty when no history files exist', () => {
    expect(getRecentSessions()).toEqual([])
  })
})

describe('Claude provider', () => {
  it('parses history.jsonl and returns sessions', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('.claude/history.jsonl')
    })
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      [
        JSON.stringify({ sessionId: 's1', display: 'Fix bug', project: '/app', timestamp: 1000 }),
        JSON.stringify({ sessionId: 's1', display: 'Fix bug', project: '/app', timestamp: 2000 }),
        JSON.stringify({
          sessionId: 's2',
          display: 'Add feature',
          project: '/app',
          timestamp: 1500
        })
      ].join('\n')
    )

    const sessions = getRecentSessions()
    const claude = sessions.filter((s) => s.agentType === 'claude')

    expect(claude).toHaveLength(2)
    // Deduplicates by sessionId, uses latest timestamp
    expect(claude[0].sessionId).toBe('s1')
    expect(claude[0].timestamp).toBe(2000)
    expect(claude[0].messageCount).toBe(2)
    // Sorted by timestamp desc
    expect(claude[1].sessionId).toBe('s2')
  })

  it('filters by projectPath', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('.claude/history.jsonl')
    })
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      [
        JSON.stringify({ sessionId: 's1', display: 'Fix', project: '/app', timestamp: 1000 }),
        JSON.stringify({ sessionId: 's2', display: 'Add', project: '/other', timestamp: 2000 })
      ].join('\n')
    )

    const sessions = getRecentSessions('/app')
    const claude = sessions.filter((s) => s.agentType === 'claude')
    expect(claude).toHaveLength(1)
    expect(claude[0].sessionId).toBe('s1')
  })
})

describe('Codex provider', () => {
  it('returns sessions from sqlite3 query', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('.codex/state_5.sqlite')
    })
    vi.mocked(execFileSync).mockReturnValueOnce(
      JSON.stringify([
        { id: 'c1', cwd: '/app', title: 'Test', updated_at: 1700000000, first_user_message: '' }
      ])
    )

    const sessions = getRecentSessions()
    const codex = sessions.filter((s) => s.agentType === 'codex')
    expect(codex).toHaveLength(1)
    expect(codex[0].sessionId).toBe('c1')
  })

  it('returns empty when DB does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const sessions = getRecentSessions()
    expect(sessions.filter((s) => s.agentType === 'codex')).toEqual([])
  })
})

describe('aggregate', () => {
  it('merges all providers, sorted by timestamp, limited', () => {
    // Claude
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return (
        String(p).includes('.claude/history.jsonl') || String(p).includes('.codex/state_5.sqlite')
      )
    })
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({ sessionId: 's1', display: 'Claude', project: '/app', timestamp: 3000 })
    )
    // Codex
    vi.mocked(execFileSync).mockReturnValueOnce(
      JSON.stringify([
        { id: 'c1', cwd: '/app', title: 'Codex', updated_at: 4, first_user_message: '' }
      ])
    )

    const sessions = getRecentSessions(undefined, 2)
    expect(sessions.length).toBeLessThanOrEqual(2)
    // Should be sorted by timestamp desc
    for (let i = 1; i < sessions.length; i++) {
      expect(sessions[i - 1].timestamp).toBeGreaterThanOrEqual(sessions[i].timestamp)
    }
  })
})
