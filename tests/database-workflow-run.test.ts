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
  saveWorkflowRun,
  listWorkflowRuns
} from '../packages/server/src/database'
import type { WorkflowExecution } from '@vornrun/shared/types'

let teardown: () => void

beforeEach(() => {
  teardown = initTestDatabase()
})

afterEach(() => {
  teardown()
})

describe('workflow run persistence', () => {
  it('round-trips agentType / projectName / projectPath on node states', () => {
    const exec: WorkflowExecution = {
      workflowId: 'wf-1',
      startedAt: '2026-04-20T10:00:00Z',
      completedAt: '2026-04-20T10:00:05Z',
      status: 'success',
      nodeStates: [
        {
          nodeId: 'node-1',
          status: 'success',
          agentSessionId: 'agent-xyz',
          agentType: 'claude',
          projectName: 'proj',
          projectPath: '/abs/proj',
          approvedAt: '2026-04-20T10:00:04Z'
        }
      ]
    }

    saveWorkflowRun(exec)
    const runs = listWorkflowRuns('wf-1')
    expect(runs).toHaveLength(1)
    const state = runs[0].nodeStates[0]
    expect(state.agentType).toBe('claude')
    expect(state.projectName).toBe('proj')
    expect(state.projectPath).toBe('/abs/proj')
    expect(state.agentSessionId).toBe('agent-xyz')
    expect(state.approvedAt).toBe('2026-04-20T10:00:04Z')
  })

  it('omits fields that were not set', () => {
    const exec: WorkflowExecution = {
      workflowId: 'wf-2',
      startedAt: '2026-04-20T11:00:00Z',
      status: 'success',
      nodeStates: [{ nodeId: 'node-1', status: 'success' }]
    }

    saveWorkflowRun(exec)
    const runs = listWorkflowRuns('wf-2')
    const state = runs[0].nodeStates[0]
    expect(state.agentType).toBeUndefined()
    expect(state.projectName).toBeUndefined()
    expect(state.projectPath).toBeUndefined()
  })
})
