import { describe, it, expect, beforeEach } from 'vitest'
import {
  setDecryptedCreds,
  clearDecryptedCreds,
  getDecryptedCreds,
  applyDecryptedCreds
} from '../packages/server/src/connectors/decrypted-creds'
import type { SourceConnection } from '../packages/shared/src/types'

function makeConn(overrides: Partial<SourceConnection> = {}): SourceConnection {
  return {
    id: 'conn-1',
    connectorId: 'github',
    name: 'owner/repo',
    filters: { owner: 'owner', repo: 'repo' },
    syncIntervalMinutes: 5,
    statusMapping: {},
    createdAt: '2026-04-24T00:00:00Z',
    ...overrides
  }
}

describe('decrypted-creds in-memory store', () => {
  beforeEach(() => {
    // Each test starts clean so state doesn't leak across cases.
    clearDecryptedCreds('conn-1')
    clearDecryptedCreds('conn-2')
  })

  it('set/get round-trips a credential set', () => {
    setDecryptedCreds('conn-1', { apiKey: 'secret', token: 't' })
    expect(getDecryptedCreds('conn-1')).toEqual({ apiKey: 'secret', token: 't' })
  })

  it('get returns undefined when no creds were set', () => {
    expect(getDecryptedCreds('conn-unknown')).toBeUndefined()
  })

  it('clear removes the entry', () => {
    setDecryptedCreds('conn-1', { apiKey: 'secret' })
    clearDecryptedCreds('conn-1')
    expect(getDecryptedCreds('conn-1')).toBeUndefined()
  })

  it('clear on unknown connection is a no-op', () => {
    expect(() => clearDecryptedCreds('conn-never-set')).not.toThrow()
  })

  it('applyDecryptedCreds overlays secrets on top of filters', () => {
    const conn = makeConn({ filters: { apiKey: '<encrypted>', teamKey: 'ENG' } })
    setDecryptedCreds(conn.id, { apiKey: 'plaintext-secret' })

    const result = applyDecryptedCreds(conn)
    expect(result).toEqual({ apiKey: 'plaintext-secret', teamKey: 'ENG' })
  })

  it('applyDecryptedCreds returns a fresh copy of filters when no secrets are set', () => {
    const conn = makeConn()
    const result = applyDecryptedCreds(conn)
    expect(result).toEqual(conn.filters)
    expect(result).not.toBe(conn.filters) // new object
  })

  it('set overwrites the previous credential set (full replacement, not merge)', () => {
    setDecryptedCreds('conn-1', { apiKey: 'first', extra: 'a' })
    setDecryptedCreds('conn-1', { apiKey: 'second' })
    expect(getDecryptedCreds('conn-1')).toEqual({ apiKey: 'second' })
  })

  it('isolates creds between connections', () => {
    setDecryptedCreds('conn-1', { apiKey: 'one' })
    setDecryptedCreds('conn-2', { apiKey: 'two' })
    expect(getDecryptedCreds('conn-1')).toEqual({ apiKey: 'one' })
    expect(getDecryptedCreds('conn-2')).toEqual({ apiKey: 'two' })
    clearDecryptedCreds('conn-1')
    expect(getDecryptedCreds('conn-2')).toEqual({ apiKey: 'two' })
  })
})
