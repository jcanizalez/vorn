import { describe, it, expect, vi } from 'vitest'

const mockSaveSessions = vi.fn()
const mockGetPrevious = vi.fn(() => [])
const mockClearSessions = vi.fn()

vi.mock('../packages/server/src/database', () => ({
  saveSessions: (...args: unknown[]) => mockSaveSessions(...args),
  getPreviousSessions: (...args: unknown[]) => mockGetPrevious(...args),
  clearSessions: (...args: unknown[]) => mockClearSessions(...args)
}))
vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { sessionManager } from '../packages/server/src/session-persistence'

describe('sessionManager', () => {
  it('saveSessions delegates to database', () => {
    const sessions = [{ id: 's1' }] as never
    sessionManager.saveSessions(sessions)
    expect(mockSaveSessions).toHaveBeenCalledWith(sessions)
  })

  it('saveSessions catches errors silently', () => {
    mockSaveSessions.mockImplementationOnce(() => {
      throw new Error('db error')
    })
    expect(() => sessionManager.saveSessions([])).not.toThrow()
  })

  it('getPreviousSessions returns DB result', () => {
    const data = [{ id: 's1' }]
    mockGetPrevious.mockReturnValueOnce(data)
    expect(sessionManager.getPreviousSessions()).toBe(data)
  })

  it('getPreviousSessions returns [] on error', () => {
    mockGetPrevious.mockImplementationOnce(() => {
      throw new Error('db error')
    })
    expect(sessionManager.getPreviousSessions()).toEqual([])
  })

  it('clear delegates to database', () => {
    sessionManager.clear()
    expect(mockClearSessions).toHaveBeenCalled()
  })

  it('clear catches errors silently', () => {
    mockClearSessions.mockImplementationOnce(() => {
      throw new Error('db error')
    })
    expect(() => sessionManager.clear()).not.toThrow()
  })
})
