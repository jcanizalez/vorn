import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => '/usr/bin/cmd') // commandExists returns true
}))

import {
  buildAgentLaunchLine,
  buildHeadlessLaunchLine,
  buildHeadlessSpawnArgs
} from '../packages/server/src/agent-launch'
import { DEFAULT_AGENT_COMMANDS } from '@vibegrid/shared/agent-defaults'
import type { AgentType, CreateTerminalPayload } from '@vibegrid/shared/types'

const env = { PATH: '/usr/bin' }
const cmds = DEFAULT_AGENT_COMMANDS

function makePayload(overrides: Partial<CreateTerminalPayload> = {}): CreateTerminalPayload {
  return {
    agentType: 'claude' as AgentType,
    projectName: 'test',
    projectPath: '/test',
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildAgentLaunchLine', () => {
  it('returns basic claude command', () => {
    expect(buildAgentLaunchLine(makePayload(), cmds, env)).toBe('claude')
  })

  it('adds --resume for claude', () => {
    const result = buildAgentLaunchLine(makePayload({ resumeSessionId: 'sess-1' }), cmds, env)
    expect(result).toBe('claude --resume sess-1')
  })

  it('adds prompt for claude (appended directly)', () => {
    const result = buildAgentLaunchLine(makePayload({ initialPrompt: 'fix bug' }), cmds, env)
    expect(result).toContain("'fix bug'")
  })

  it('uses -i flag for copilot initialPrompt', () => {
    const result = buildAgentLaunchLine(
      makePayload({ agentType: 'copilot', initialPrompt: 'fix' }),
      cmds,
      env
    )
    expect(result).toContain('-i')
  })

  it('uses resume subcommand for codex', () => {
    const result = buildAgentLaunchLine(
      makePayload({ agentType: 'codex', resumeSessionId: 'sess-1' }),
      cmds,
      env
    )
    expect(result).toBe('codex resume sess-1')
  })

  it('uses --session for opencode', () => {
    const result = buildAgentLaunchLine(
      makePayload({ agentType: 'opencode', resumeSessionId: 'sess-1' }),
      cmds,
      env
    )
    expect(result).toContain('--session sess-1')
  })

  it('does not inject a fake exact-resume flag for gemini', () => {
    const result = buildAgentLaunchLine(
      makePayload({ agentType: 'gemini', resumeSessionId: 'any-id' }),
      cmds,
      env
    )
    expect(result).toBe('gemini')
  })

  it('uses per-step args over settings-level args', () => {
    const result = buildAgentLaunchLine(makePayload({ args: ['--verbose'] }), cmds, env)
    expect(result).toContain('--verbose')
  })
})

describe('buildHeadlessLaunchLine', () => {
  it('builds claude with -p and headlessArgs', () => {
    const result = buildHeadlessLaunchLine(makePayload({ initialPrompt: 'do it' }), cmds, env)
    expect(result).toContain('claude')
    expect(result).toContain('--dangerously-skip-permissions')
    expect(result).toContain('-p')
  })

  it('builds copilot with --allow-all', () => {
    const result = buildHeadlessLaunchLine(
      makePayload({ agentType: 'copilot', initialPrompt: 'do it' }),
      cmds,
      env
    )
    expect(result).toContain('--allow-all')
    expect(result).toContain('-p')
  })

  it('builds codex with exec subcommand', () => {
    const result = buildHeadlessLaunchLine(
      makePayload({ agentType: 'codex', initialPrompt: 'do it' }),
      cmds,
      env
    )
    expect(result).toContain('exec')
    expect(result).toContain('-a never')
  })

  it('builds opencode with run subcommand', () => {
    const result = buildHeadlessLaunchLine(
      makePayload({ agentType: 'opencode', initialPrompt: 'do it' }),
      cmds,
      env
    )
    expect(result).toContain('run')
  })

  it('builds gemini with -y flag', () => {
    const result = buildHeadlessLaunchLine(
      makePayload({ agentType: 'gemini', initialPrompt: 'do it' }),
      cmds,
      env
    )
    expect(result).toContain('-y')
    expect(result).toContain('-p')
  })

  it('uses empty quoted string when no prompt', () => {
    const result = buildHeadlessLaunchLine(makePayload(), cmds, env)
    expect(result).toContain("''")
  })

  it('per-step args override headlessArgs', () => {
    const result = buildHeadlessLaunchLine(makePayload({ args: ['--custom'] }), cmds, env)
    expect(result).toContain('--custom')
    expect(result).not.toContain('--dangerously-skip-permissions')
  })
})

describe('buildHeadlessSpawnArgs', () => {
  it('returns { command, args } for claude', () => {
    const result = buildHeadlessSpawnArgs(makePayload({ initialPrompt: 'hello' }), cmds, env)
    expect(result.command).toBe('claude')
    expect(result.args).toContain('-p')
    expect(result.args).toContain('hello')
    expect(result.args).toContain('--dangerously-skip-permissions')
  })

  it('returns exec for codex', () => {
    const result = buildHeadlessSpawnArgs(
      makePayload({ agentType: 'codex', initialPrompt: 'fix' }),
      cmds,
      env
    )
    expect(result.args).toContain('exec')
    expect(result.args).toContain('fix')
  })

  it('returns run for opencode', () => {
    const result = buildHeadlessSpawnArgs(
      makePayload({ agentType: 'opencode', initialPrompt: 'fix' }),
      cmds,
      env
    )
    expect(result.args).toContain('run')
  })

  it('uses empty string for missing prompt', () => {
    const result = buildHeadlessSpawnArgs(makePayload(), cmds, env)
    expect(result.args).toContain('')
  })
})
