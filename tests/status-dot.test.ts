import { describe, it, expect } from 'vitest'
import { STATUS_DOT_CLASSES } from '../src/renderer/components/workflow-editor/statusDot'

describe('STATUS_DOT_CLASSES', () => {
  it('maps each known status to a tailwind class', () => {
    expect(STATUS_DOT_CLASSES.success).toBe('bg-green-400')
    expect(STATUS_DOT_CLASSES.error).toBe('bg-red-500')
    expect(STATUS_DOT_CLASSES.running).toContain('bg-yellow-400')
    expect(STATUS_DOT_CLASSES.running).toContain('animate-pulse')
    expect(STATUS_DOT_CLASSES.pending).toBe('bg-gray-600')
    expect(STATUS_DOT_CLASSES.skipped).toBe('bg-gray-600')
  })
})
