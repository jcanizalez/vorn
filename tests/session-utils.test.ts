// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TerminalSession, RecentSession, AgentType } from '../packages/shared/src/types'

const mockGetRecentSessions = vi.fn()

// Mock window.api
Object.defineProperty(window, 'api', {
  value: { getRecentSessions: (...args: unknown[]) => mockGetRecentSessions(...args) },
  writable: true
})

import { resolveResumeSessionId, resolveProjectName } from '../src/renderer/lib/session-utils'

function makeSession(overrides: Partial<TerminalSession> = {}): TerminalSession {
  return {
    id: 'term-1',
    agentType: 'claude' as AgentType,
    projectName: 'my-app',
    projectPath: '/home/user/my-app',
    status: 'running',
    createdAt: Date.now(),
    pid: 1234,
    ...overrides
  }
}

function makeRecent(overrides: Partial<RecentSession> = {}): RecentSession {
  return {
    sessionId: 'sess-1',
    agentType: 'claude' as AgentType,
    display: 'Fix bug',
    projectPath: '/home/user/my-app',
    timestamp: Date.now(),
    activityCount: 5,
    activityLabel: 'message',
    canResumeExact: true,
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetRecentSessions.mockResolvedValue([])
})

describe('resolveResumeSessionId', () => {
  it('returns hookSessionId immediately when present', async () => {
    const session = makeSession({ hookSessionId: 'hook-abc' })
    const result = await resolveResumeSessionId(session)
    expect(result).toBe('hook-abc')
    expect(mockGetRecentSessions).not.toHaveBeenCalled()
  })

  it('returns exact-match sessionId from recent sessions', async () => {
    mockGetRecentSessions.mockResolvedValue([
      makeRecent({ sessionId: 'sess-match', projectPath: '/home/user/my-app' })
    ])
    const session = makeSession({ projectPath: '/home/user/my-app' })
    const result = await resolveResumeSessionId(session)
    expect(result).toBe('sess-match')
  })

  it('prefers worktree path matches over project root matches', async () => {
    mockGetRecentSessions.mockResolvedValue([
      makeRecent({ sessionId: 'sess-root', projectPath: '/home/user/my-app' }),
      makeRecent({
        sessionId: 'sess-worktree',
        projectPath: '/home/user/.vibegrid-worktrees/my-app/feature-a'
      })
    ])
    const session = makeSession({
      projectPath: '/home/user/my-app',
      worktreePath: '/home/user/.vibegrid-worktrees/my-app/feature-a'
    })

    const result = await resolveResumeSessionId(session)
    expect(result).toBe('sess-worktree')
  })

  it('falls back to basename match when exact path differs', async () => {
    // Scoped call returns nothing; unscoped returns a session with different path but same basename
    mockGetRecentSessions.mockImplementation((projectPath?: string) => {
      if (projectPath) return Promise.resolve([])
      return Promise.resolve([
        makeRecent({ sessionId: 'sess-fuzzy', projectPath: '/private/var/folders/my-app' })
      ])
    })
    const session = makeSession({ projectPath: '/var/folders/my-app' })
    const result = await resolveResumeSessionId(session)
    expect(result).toBe('sess-fuzzy')
  })

  it('does not match basename across different agent types', async () => {
    mockGetRecentSessions.mockImplementation((projectPath?: string) => {
      if (projectPath) return Promise.resolve([])
      return Promise.resolve([
        makeRecent({
          sessionId: 'sess-other',
          agentType: 'copilot' as AgentType,
          projectPath: '/other/path/my-app'
        })
      ])
    })
    const session = makeSession({
      agentType: 'claude' as AgentType,
      projectPath: '/home/user/my-app'
    })
    const result = await resolveResumeSessionId(session)
    expect(result).toBeUndefined()
  })

  it('returns undefined when no match found', async () => {
    // Scoped call returns nothing; unscoped returns non-matching session
    mockGetRecentSessions.mockImplementation((projectPath?: string) => {
      if (projectPath) return Promise.resolve([])
      return Promise.resolve([
        makeRecent({
          sessionId: 'sess-other',
          agentType: 'copilot' as AgentType,
          projectPath: '/completely/different'
        })
      ])
    })
    const session = makeSession({ projectPath: '/home/user/my-app' })
    const result = await resolveResumeSessionId(session)
    expect(result).toBeUndefined()
  })

  it('tries scoped fetch first, then unscoped fallback', async () => {
    mockGetRecentSessions.mockResolvedValue([])
    const session = makeSession()
    await resolveResumeSessionId(session)
    expect(mockGetRecentSessions).toHaveBeenCalledTimes(2)
    expect(mockGetRecentSessions).toHaveBeenNthCalledWith(1, session.projectPath)
    expect(mockGetRecentSessions).toHaveBeenNthCalledWith(2)
  })

  it('skips already-claimed session IDs', async () => {
    mockGetRecentSessions.mockResolvedValue([
      makeRecent({ sessionId: 'sess-1', projectPath: '/home/user/my-app' }),
      makeRecent({ sessionId: 'sess-2', projectPath: '/home/user/my-app' })
    ])
    const session = makeSession({ projectPath: '/home/user/my-app' })

    // First call claims sess-1
    const claimed = new Set<string>()
    const first = await resolveResumeSessionId(session, claimed)
    expect(first).toBe('sess-1')
    claimed.add(first!)

    // Second call with same session skips sess-1, returns sess-2
    const second = await resolveResumeSessionId(session, claimed)
    expect(second).toBe('sess-2')
  })

  it('skips claimed hookSessionId', async () => {
    const claimed = new Set(['hook-abc'])
    const session = makeSession({ hookSessionId: 'hook-abc' })
    mockGetRecentSessions.mockResolvedValue([
      makeRecent({ sessionId: 'sess-fallback', projectPath: '/home/user/my-app' })
    ])
    const result = await resolveResumeSessionId(session, claimed)
    expect(result).toBe('sess-fallback')
  })

  it('does not attempt exact resume for gemini sessions', async () => {
    const session = makeSession({
      agentType: 'gemini' as AgentType,
      hookSessionId: 'gemini-hook'
    })
    const result = await resolveResumeSessionId(session)
    expect(result).toBeUndefined()
    expect(mockGetRecentSessions).not.toHaveBeenCalled()
  })
})

describe('resolveProjectName', () => {
  const projects = [
    { name: 'My App', path: '/home/user/my-app' },
    { name: 'Backend', path: '/home/user/backend' }
  ]

  it('returns project name on exact match', () => {
    const session = makeRecent({ projectPath: '/home/user/my-app' })
    expect(resolveProjectName(session, projects)).toBe('My App')
  })

  it('matches when paths differ only by trailing slash', () => {
    const session = makeRecent({ projectPath: '/home/user/my-app/' })
    expect(resolveProjectName(session, projects)).toBe('My App')
  })

  it('returns basename when no projects provided', () => {
    const session = makeRecent({ projectPath: '/home/user/my-app' })
    expect(resolveProjectName(session, undefined)).toBe('my-app')
  })

  it('returns basename when no project matches', () => {
    const session = makeRecent({ projectPath: '/home/user/unknown' })
    expect(resolveProjectName(session, projects)).toBe('unknown')
  })

  it('returns project name for managed worktree paths', () => {
    const session = makeRecent({
      projectPath: '/home/user/.vibegrid-worktrees/my-app/feature-a'
    })
    expect(resolveProjectName(session, projects)).toBe('My App')
  })

  it('returns untitled for root path', () => {
    const session = makeRecent({ projectPath: '/' })
    expect(resolveProjectName(session, projects)).toBe('untitled')
  })
})
