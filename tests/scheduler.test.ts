import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowDefinition, WorkflowNode, TriggerConfig } from '../src/shared/types'

// Mock dependencies before importing
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) }
}))
vi.mock('electron', () => ({
  BrowserWindow: vi.fn()
}))
vi.mock('../src/main/config-manager', () => ({
  configManager: { loadConfig: vi.fn(), saveConfig: vi.fn() }
}))
vi.mock('../src/main/schedule-log', () => ({
  scheduleLogManager: { addEntry: vi.fn() }
}))

import { scheduler } from '../src/main/scheduler'

function makeTriggerNode(config: TriggerConfig): WorkflowNode {
  return {
    id: 'trigger-1',
    type: 'trigger',
    label: 'Trigger',
    config,
    position: { x: 0, y: 0 }
  }
}

function makeWorkflow(overrides: Partial<WorkflowDefinition> & { triggerConfig?: TriggerConfig } = {}): WorkflowDefinition {
  const { triggerConfig, ...rest } = overrides
  const trigger = triggerConfig ?? { triggerType: 'manual' as const }
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    icon: 'Rocket',
    iconColor: '#000',
    nodes: [makeTriggerNode(trigger)],
    edges: [],
    enabled: true,
    ...rest
  }
}

describe('checkMissedSchedules', () => {
  it('returns empty for manual schedules', () => {
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'manual' } })
    expect(scheduler.checkMissedSchedules([wf])).toEqual([])
  })

  it('returns empty for recurring schedules', () => {
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'recurring', cron: '0 9 * * *' } })
    expect(scheduler.checkMissedSchedules([wf])).toEqual([])
  })

  it('returns missed for past once schedule with no lastRunAt', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'once', runAt: pastDate } })
    const result = scheduler.checkMissedSchedules([wf])
    expect(result).toHaveLength(1)
    expect(result[0].workflow.id).toBe('wf-1')
    expect(result[0].scheduledFor).toBe(pastDate)
  })

  it('returns empty for past once schedule that already ran', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    const wf = makeWorkflow({
      triggerConfig: { triggerType: 'once', runAt: pastDate },
      lastRunAt: pastDate
    })
    expect(scheduler.checkMissedSchedules([wf])).toEqual([])
  })

  it('returns empty for future once schedule', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString()
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'once', runAt: futureDate } })
    expect(scheduler.checkMissedSchedules([wf])).toEqual([])
  })

  it('skips disabled workflows', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    const wf = makeWorkflow({
      triggerConfig: { triggerType: 'once', runAt: pastDate },
      enabled: false
    })
    expect(scheduler.checkMissedSchedules([wf])).toEqual([])
  })
})

describe('getNextRun', () => {
  it('returns null for missing workflow', () => {
    expect(scheduler.getNextRun('nonexistent', [])).toBeNull()
  })

  it('returns null for disabled workflow', () => {
    const wf = makeWorkflow({ enabled: false, triggerConfig: { triggerType: 'recurring', cron: '0 9 * * *' } })
    expect(scheduler.getNextRun('wf-1', [wf])).toBeNull()
  })

  it('returns ISO string for future once schedule', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString()
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'once', runAt: futureDate } })
    expect(scheduler.getNextRun('wf-1', [wf])).toBe(futureDate)
  })

  it('returns null for past once schedule', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'once', runAt: pastDate } })
    expect(scheduler.getNextRun('wf-1', [wf])).toBeNull()
  })

  it('returns cron expression for recurring schedule', () => {
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'recurring', cron: '0 9 * * *' } })
    expect(scheduler.getNextRun('wf-1', [wf])).toBe('0 9 * * *')
  })

  it('returns null for manual schedule', () => {
    const wf = makeWorkflow({ triggerConfig: { triggerType: 'manual' } })
    expect(scheduler.getNextRun('wf-1', [wf])).toBeNull()
  })
})
