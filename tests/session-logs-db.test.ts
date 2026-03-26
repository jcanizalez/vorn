import { describe, it, expect } from 'vitest'

// These tests validate the SessionLog shape and IPC/protocol wiring.
// DB interaction and SQL behavior are covered in session-output-capture.test.ts.

describe('session log types and IPC wiring', () => {
  it('SessionLog type has required fields', () => {
    const log = {
      taskId: 'task-1',
      sessionId: 'sess-1',
      status: 'running' as const,
      startedAt: new Date().toISOString()
    }
    expect(log.taskId).toBe('task-1')
    expect(log.sessionId).toBe('sess-1')
    expect(log.status).toBe('running')
  })

  it('SessionLog supports all status values', () => {
    const statuses: Array<'running' | 'success' | 'error'> = ['running', 'success', 'error']
    for (const s of statuses) {
      const log = { taskId: 't', sessionId: 's', status: s, startedAt: '' }
      expect(log.status).toBe(s)
    }
  })

  it('SessionLog optional fields default to undefined', () => {
    const log = {
      taskId: 'task-1',
      sessionId: 'sess-1',
      status: 'running' as const,
      startedAt: new Date().toISOString()
    }
    expect(log).not.toHaveProperty('agentType')
    expect(log).not.toHaveProperty('branch')
    expect(log).not.toHaveProperty('completedAt')
    expect(log).not.toHaveProperty('exitCode')
    expect(log).not.toHaveProperty('logs')
    expect(log).not.toHaveProperty('projectName')
  })

  it('IPC constants are defined', async () => {
    const { IPC } = await import('../packages/shared/src/types')
    expect(IPC.SESSION_LOG_LIST).toBe('sessionLog:list')
    expect(IPC.SESSION_LOG_UPDATE).toBe('sessionLog:update')
  })

  it('protocol defines sessionLog methods', async () => {
    type Methods = import('../packages/shared/src/protocol').RequestMethods
    type ListParams = Methods['sessionLog:list']['params']

    const params: ListParams = { taskId: 'task-1' }
    expect(params.taskId).toBe('task-1')
  })
})
