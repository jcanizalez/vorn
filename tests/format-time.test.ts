import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { formatRelativeTime } from '../src/renderer/lib/format-time'

const NOW = new Date('2026-04-16T12:00:00Z').getTime()

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterAll(() => {
  vi.useRealTimers()
})

describe('formatRelativeTime', () => {
  it('returns "Just now" for times less than a minute ago', () => {
    expect(formatRelativeTime(new Date(NOW - 30_000).toISOString())).toBe('Just now')
  })

  it('returns minutes for times less than an hour ago', () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString())).toBe('5m ago')
    expect(formatRelativeTime(new Date(NOW - 59 * 60_000).toISOString())).toBe('59m ago')
  })

  it('returns hours for times less than a day ago', () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 3_600_000).toISOString())).toBe('3h ago')
    expect(formatRelativeTime(new Date(NOW - 23 * 3_600_000).toISOString())).toBe('23h ago')
  })

  it('returns days for times less than 30 days ago', () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 86_400_000).toISOString())).toBe('5d ago')
    expect(formatRelativeTime(new Date(NOW - 29 * 86_400_000).toISOString())).toBe('29d ago')
  })

  it('returns formatted date for times older than 30 days', () => {
    const result = formatRelativeTime(new Date(NOW - 60 * 86_400_000).toISOString())
    expect(result).not.toContain('ago')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns "Unknown" for invalid ISO strings', () => {
    expect(formatRelativeTime('not-a-date')).toBe('Unknown')
    expect(formatRelativeTime('')).toBe('Unknown')
  })

  it('returns absolute timestamp for future dates', () => {
    const future = new Date(NOW + 3_600_000).toISOString()
    const result = formatRelativeTime(future)
    expect(result).not.toBe('Just now')
    expect(result).not.toContain('ago')
  })
})
