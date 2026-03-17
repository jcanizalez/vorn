import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInitDb = vi.fn()
const mockCloseDb = vi.fn()
const mockLoadConfig = vi.fn()
const mockSaveConfig = vi.fn()

vi.mock('../packages/server/src/database', () => ({
  initDatabase: () => mockInitDb(),
  closeDatabase: () => mockCloseDb(),
  loadConfig: () => mockLoadConfig(),
  saveConfig: (...args: unknown[]) => mockSaveConfig(...args)
}))
vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('node:fs', () => ({
  default: {
    watch: vi.fn(() => ({ close: vi.fn() })),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn()
  }
}))

import fs from 'node:fs'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

async function getConfigManager() {
  const mod = await import('../packages/server/src/config-manager')
  return mod.configManager
}

describe('configManager', () => {
  it('init calls initDatabase', async () => {
    const cm = await getConfigManager()
    cm.init()
    expect(mockInitDb).toHaveBeenCalled()
  })

  it('loadConfig returns DB result on success', async () => {
    const config = { version: 1, defaults: { shell: '/bin/zsh' }, projects: [] }
    mockLoadConfig.mockReturnValueOnce(config)
    const cm = await getConfigManager()
    expect(cm.loadConfig()).toEqual(config)
  })

  it('loadConfig returns defaults on error', async () => {
    mockLoadConfig.mockImplementationOnce(() => {
      throw new Error('db error')
    })
    const cm = await getConfigManager()
    const result = cm.loadConfig()
    expect(result.version).toBe(1)
    expect(result.defaults).toBeDefined()
  })

  it('saveConfig delegates to DB', async () => {
    const config = { version: 1, defaults: { shell: '/bin/zsh' } }
    const cm = await getConfigManager()
    cm.saveConfig(config as never)
    expect(mockSaveConfig).toHaveBeenCalledWith(config)
  })

  it('saveConfig throws on DB error', async () => {
    mockSaveConfig.mockImplementationOnce(() => {
      throw new Error('write failed')
    })
    const cm = await getConfigManager()
    expect(() => cm.saveConfig({} as never)).toThrow('write failed')
  })

  it('onConfigChanged + notifyChanged calls callbacks with fresh config', async () => {
    const config = { version: 1, defaults: { shell: '/bin/zsh' }, projects: [] }
    mockLoadConfig.mockReturnValue(config)

    const cm = await getConfigManager()
    const callback = vi.fn()
    cm.onConfigChanged(callback)
    cm.notifyChanged()
    expect(callback).toHaveBeenCalledWith(config)
  })

  it('watchDb calls fs.watch on the DB directory', async () => {
    const cm = await getConfigManager()
    cm.watchDb()
    expect(fs.watch).toHaveBeenCalled()
  })

  it('close calls closeDatabase and stops watcher', async () => {
    const cm = await getConfigManager()
    cm.close()
    expect(mockCloseDb).toHaveBeenCalled()
  })
})
