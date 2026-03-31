import { describe, it, expect } from 'vitest'
import { createStatusContext, analyzeOutput } from '../packages/server/src/status-parser'

describe('createStatusContext', () => {
  it('creates context with empty buffer', () => {
    const ctx = createStatusContext()
    expect(ctx.outputBuffer).toBe('')
    expect(ctx.lastOutputTime).toBeGreaterThan(0)
  })
})

describe('analyzeOutput', () => {
  it('returns running for normal output', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Building project...\nCompiling files...')).toBe('running')
  })

  // Waiting patterns
  it('returns waiting for $ prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'user@host:~/project$ ')).toBe('waiting')
  })

  it('returns waiting for ❯ prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, '~/project ❯ ')).toBe('waiting')
  })

  it('returns waiting for > prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, '> ')).toBe('waiting')
  })

  it('returns waiting for (y/n) prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Continue? (y/n)')).toBe('waiting')
  })

  it('returns waiting for ? prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Are you sure? ')).toBe('waiting')
  })

  it('returns waiting for Enter prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Enter your name:')).toBe('waiting')
  })

  it('returns waiting for ]$ prompt', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, '[user@host project]$ ')).toBe('waiting')
  })

  // Error patterns
  it('returns error for error: prefix', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'error: something went wrong')).toBe('error')
  })

  it('returns error for Error: prefix', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Error: file not found')).toBe('error')
  })

  it('returns error for FATAL', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'FATAL: cannot continue')).toBe('error')
  })

  it('returns error for panic:', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'panic: runtime error')).toBe('error')
  })

  it('returns error for Traceback', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Traceback (most recent call last):')).toBe('error')
  })

  it('returns error for command not found', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'bash: foo: command not found')).toBe('error')
  })

  it('returns error for ENOENT', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'Error: ENOENT: no such file')).toBe('error')
  })

  it('returns error for EACCES', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'EACCES: permission denied')).toBe('error')
  })

  // Priority: error checked before waiting
  it('error takes priority over waiting pattern', () => {
    const ctx = createStatusContext()
    expect(analyzeOutput(ctx, 'error: something failed\n$ ')).toBe('error')
  })

  // Buffer behavior
  it('truncates buffer to last 2000 chars', () => {
    const ctx = createStatusContext()
    const longOutput = 'x'.repeat(3000)
    analyzeOutput(ctx, longOutput)
    expect(ctx.outputBuffer.length).toBe(2000)
  })

  it('accumulates output across calls', () => {
    const ctx = createStatusContext()
    analyzeOutput(ctx, 'line 1\n')
    analyzeOutput(ctx, 'line 2\n')
    expect(ctx.outputBuffer).toContain('line 1')
    expect(ctx.outputBuffer).toContain('line 2')
  })

  it('updates lastOutputTime', () => {
    const ctx = createStatusContext()
    const before = ctx.lastOutputTime
    analyzeOutput(ctx, 'new data')
    expect(ctx.lastOutputTime).toBeGreaterThanOrEqual(before)
  })
})
