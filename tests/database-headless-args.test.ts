import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, existsSync: vi.fn(() => true), mkdirSync: vi.fn() }
})

import { initTestDatabase, saveConfig, loadConfig } from '../packages/server/src/database'
import { DEFAULT_AGENT_COMMANDS } from '@vibegrid/shared/agent-defaults'
import type { AppConfig } from '@vibegrid/shared/types'

let teardown: () => void

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    version: 1,
    defaults: { theme: 'dark' },
    projects: [],
    agentCommands: { ...DEFAULT_AGENT_COMMANDS },
    workflows: [],
    tasks: [],
    ...overrides
  }
}

beforeEach(() => {
  teardown = initTestDatabase()
})

afterEach(() => {
  teardown()
})

describe('headlessArgs persistence (real SQLite)', () => {
  it('saves and loads headlessArgs for agent commands', () => {
    const config = makeConfig({
      agentCommands: {
        ...DEFAULT_AGENT_COMMANDS,
        claude: {
          ...DEFAULT_AGENT_COMMANDS.claude,
          headlessArgs: ['--dangerously-skip-permissions', '--verbose']
        }
      }
    })
    saveConfig(config)
    const loaded = loadConfig()
    expect(loaded.agentCommands.claude?.headlessArgs).toEqual([
      '--dangerously-skip-permissions',
      '--verbose'
    ])
  })

  it('loads headlessArgs as undefined when not set', () => {
    const config = makeConfig({
      agentCommands: {
        ...DEFAULT_AGENT_COMMANDS,
        opencode: { command: 'opencode', args: [] }
      }
    })
    saveConfig(config)
    const loaded = loadConfig()
    expect(loaded.agentCommands.opencode?.headlessArgs).toBeUndefined()
  })

  it('preserves headlessArgs across save/load round-trips', () => {
    const config = makeConfig()
    saveConfig(config)

    // Update with custom headlessArgs
    const loaded = loadConfig()
    loaded.agentCommands.gemini = {
      ...DEFAULT_AGENT_COMMANDS.gemini,
      headlessArgs: ['-y', '--no-confirm']
    }
    saveConfig(loaded)

    const reloaded = loadConfig()
    expect(reloaded.agentCommands.gemini?.headlessArgs).toEqual(['-y', '--no-confirm'])
    // Other agents should keep their defaults
    expect(reloaded.agentCommands.claude?.headlessArgs).toEqual(['--dangerously-skip-permissions'])
  })
})
