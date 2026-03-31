import { describe, it, expect, beforeEach } from 'vitest'
import {
  createStatusContext,
  analyzeOutput,
  StatusContext
} from '../packages/server/src/status-parser'

describe('server-side status detection', () => {
  let ctx: StatusContext

  beforeEach(() => {
    ctx = createStatusContext()
  })

  describe('analyzeOutput returns correct status from ANSI-stripped data', () => {
    it('detects shell prompt as waiting', () => {
      expect(analyzeOutput(ctx, 'user@host:~/project$ ')).toBe('waiting')
    })

    it('detects active output as running', () => {
      expect(analyzeOutput(ctx, 'Installing packages...\nResolving dependencies...')).toBe(
        'running'
      )
    })

    it('detects error output', () => {
      expect(analyzeOutput(ctx, 'error: compilation failed')).toBe('error')
    })

    it('returns running after error is scrolled out of recent lines', () => {
      // Error in early output
      analyzeOutput(ctx, 'error: minor issue\n')
      // Push it out of the 5-line window
      analyzeOutput(ctx, 'line1\nline2\nline3\nline4\nline5\nline6\n')
      expect(analyzeOutput(ctx, 'Building...')).toBe('running')
    })
  })

  describe('StatusContext tracks buffer state', () => {
    it('accumulates output across calls', () => {
      analyzeOutput(ctx, 'chunk1\n')
      analyzeOutput(ctx, 'chunk2\n')
      expect(ctx.outputBuffer).toContain('chunk1')
      expect(ctx.outputBuffer).toContain('chunk2')
    })

    it('caps buffer at 2000 chars', () => {
      analyzeOutput(ctx, 'x'.repeat(3000))
      expect(ctx.outputBuffer.length).toBe(2000)
    })

    it('updates lastOutputTime', () => {
      const before = ctx.lastOutputTime
      analyzeOutput(ctx, 'data')
      expect(ctx.lastOutputTime).toBeGreaterThanOrEqual(before)
    })
  })

  describe('pattern-based detection for various agent outputs', () => {
    it('detects y/n prompt as waiting', () => {
      expect(analyzeOutput(ctx, 'Proceed? (y/n)')).toBe('waiting')
    })

    it('detects Enter prompt as waiting', () => {
      expect(analyzeOutput(ctx, 'Enter your password:')).toBe('waiting')
    })

    it('detects ❯ prompt as waiting', () => {
      expect(analyzeOutput(ctx, '~/project ❯ ')).toBe('waiting')
    })

    it('detects FATAL as error', () => {
      expect(analyzeOutput(ctx, 'FATAL: cannot allocate memory')).toBe('error')
    })

    it('detects Traceback as error', () => {
      expect(analyzeOutput(ctx, 'Traceback (most recent call last):')).toBe('error')
    })

    it('detects command not found as error', () => {
      expect(analyzeOutput(ctx, 'bash: foo: command not found')).toBe('error')
    })

    it('error takes priority over waiting on same output', () => {
      expect(analyzeOutput(ctx, 'error: bad input\n$ ')).toBe('error')
    })
  })
})
