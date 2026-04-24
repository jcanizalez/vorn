import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

// Re-import the module in each test so the registry starts fresh.
async function freshRegistry() {
  vi.resetModules()
  const mod = await import('../packages/server/src/connectors/registry')
  return mod.connectorRegistry
}

function makeConnector(id: string): import('../packages/shared/src/types').VornConnector {
  return {
    id,
    name: id,
    icon: id,
    capabilities: ['tasks'],
    describe: () => ({ auth: [] })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConnectorRegistry', () => {
  it('registers and retrieves a connector by id', async () => {
    const registry = await freshRegistry()
    const c = makeConnector('github')
    registry.register(c)
    expect(registry.get('github')).toBe(c)
  })

  it('returns undefined for unknown ids', async () => {
    const registry = await freshRegistry()
    expect(registry.get('nope')).toBeUndefined()
  })

  it('list returns all registered connectors in registration order', async () => {
    const registry = await freshRegistry()
    registry.register(makeConnector('github'))
    registry.register(makeConnector('linear'))
    expect(registry.list().map((c) => c.id)).toEqual(['github', 'linear'])
  })

  it('has() is true only after registration', async () => {
    const registry = await freshRegistry()
    expect(registry.has('github')).toBe(false)
    registry.register(makeConnector('github'))
    expect(registry.has('github')).toBe(true)
  })

  it('registering twice with the same id overwrites the previous connector', async () => {
    const registry = await freshRegistry()
    const first = makeConnector('github')
    const second = makeConnector('github')
    registry.register(first)
    registry.register(second)
    expect(registry.get('github')).toBe(second)
    expect(registry.list()).toHaveLength(1)
  })
})
