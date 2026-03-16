import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
  return {
    ...actual,
    execFileSync: vi.fn(() => {
      throw new Error('mock shell env')
    })
  }
})

describe('process-utils (server package)', () => {
  const originalEnv = process.env

  const TEST_ENV = {
    HOME: '/home/user',
    PATH: '/usr/bin',
    SHELL: '/bin/zsh',
    GITHUB_TOKEN: 'ghp_secret123',
    AWS_SECRET_ACCESS_KEY: 'aws-secret',
    OPENAI_API_KEY: 'sk-openai',
    CLAUDECODE: 'nested-session',
    EDITOR: 'vim',
    TERM: 'xterm-256color'
  }

  beforeEach(async () => {
    vi.resetModules()
    process.env = { ...TEST_ENV }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('shellEscape skips quoting for simple safe strings', async () => {
    const { shellEscape } = await import('../packages/server/src/process-utils')
    // Simple flags — no quotes needed
    expect(shellEscape('--dangerously-skip-permissions')).toBe('--dangerously-skip-permissions')
    expect(shellEscape('--allow-all')).toBe('--allow-all')
    expect(shellEscape('-y')).toBe('-y')
    expect(shellEscape('-a')).toBe('-a')
    expect(shellEscape('never')).toBe('never')
    // Paths and values without spaces
    expect(shellEscape('/usr/bin/claude')).toBe('/usr/bin/claude')
    expect(shellEscape('--model=opus')).toBe('--model=opus')
    expect(shellEscape('file.txt')).toBe('file.txt')
  })

  it('shellEscape quotes strings with special characters', async () => {
    const { shellEscape } = await import('../packages/server/src/process-utils')
    // Strings with spaces
    expect(shellEscape('hello world')).toBe("'hello world'")
    expect(shellEscape('fix the bug')).toBe("'fix the bug'")
    // Strings with single quotes
    expect(shellEscape("it's")).toBe("'it'\\''s'")
    // Strings with shell metacharacters
    expect(shellEscape('echo $HOME')).toBe("'echo $HOME'")
    expect(shellEscape('a && b')).toBe("'a && b'")
    expect(shellEscape('test;rm -rf')).toBe("'test;rm -rf'")
    expect(shellEscape('$(whoami)')).toBe("'$(whoami)'")
    expect(shellEscape('`id`')).toBe("'`id`'")
    // Empty string
    expect(shellEscape('')).toBe("''")
  })

  it('getSafeEnv filters sensitive vars', async () => {
    const { getSafeEnv } = await import('../packages/server/src/process-utils')
    const env = getSafeEnv()
    expect(env.HOME).toBe('/home/user')
    expect(env.PATH).toBe('/usr/bin')
    expect(env.EDITOR).toBe('vim')
    // Filtered
    expect(env.GITHUB_TOKEN).toBeUndefined()
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.CLAUDECODE).toBeUndefined()
  })

  it('getDefaultShell returns SHELL or fallback', async () => {
    const { getDefaultShell } = await import('../packages/server/src/process-utils')
    const shell = getDefaultShell()
    expect(shell).toBe('/bin/zsh') // from TEST_ENV
  })
})
