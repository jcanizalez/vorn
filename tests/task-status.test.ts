import { describe, it, expect, vi } from 'vitest'

// Mock lucide-react to avoid React dependency
vi.mock('lucide-react', () => ({
  Circle: 'Circle',
  Clock: 'Clock',
  Eye: 'Eye',
  CheckCircle2: 'CheckCircle2',
  XCircle: 'XCircle'
}))

import { formatTaskDate, getTaskShortId } from '../src/renderer/lib/task-status'

describe('formatTaskDate', () => {
  it('formats ISO date to month and day', () => {
    const result = formatTaskDate('2025-03-15T12:00:00.000Z')
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/15/)
  })
})

describe('getTaskShortId', () => {
  it('uses first 3 alpha chars of project name uppercased', () => {
    const result = getTaskShortId({ projectName: 'vibegrid', id: 'abc12345' })
    expect(result).toBe('VIB-ABC1')
  })

  it('falls back to TSK for non-alpha project name', () => {
    const result = getTaskShortId({ projectName: '123', id: 'xyz99999' })
    expect(result).toBe('TSK-XYZ9')
  })

  it('uses first 4 chars of id uppercased', () => {
    const result = getTaskShortId({ projectName: 'app', id: 'deadbeef' })
    expect(result).toBe('APP-DEAD')
  })
})
