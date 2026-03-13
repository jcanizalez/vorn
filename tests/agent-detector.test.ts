import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'

type ExecFileCallback = (err: Error | null, stdout: string, stderr: string) => void

// Capture the env passed to execFile so we can assert on it
const execFileMock = vi.fn(
  (_cmd: string, _args: string[], _opts: Record<string, unknown>, cb: ExecFileCallback) => {
    // Simulate "command not found" by default
    const err = new Error('not found') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    cb(err, '', '')
  }
)

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) =>
    execFileMock(
      args[0] as string,
      args[1] as string[],
      args[2] as Record<string, unknown>,
      args[3] as ExecFileCallback
    ),
  execFileSync: vi.fn(() => {
    throw new Error('mock shell env')
  })
}))

vi.mock('node:util', async () => {
  const actual = await vi.importActual<typeof import('node:util')>('node:util')
  return {
    ...actual,
    // promisify(execFile) should return a function that calls our mock as a promise
    promisify: (fn: unknown) => {
      if (fn === execFile) {
        return (cmd: string, args: string[], opts: Record<string, unknown>) =>
          new Promise((resolve, reject) => {
            execFileMock(cmd, args, opts, (err: Error | null, stdout: string, stderr: string) => {
              if (err) reject(err)
              else resolve({ stdout, stderr })
            })
          })
      }
      return actual.promisify(fn as never)
    }
  }
})

// Mock heavy deps that pty-manager pulls in
vi.mock('node-pty', () => ({ default: {} }))
vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))
vi.mock('../src/main/git-utils', () => ({
  getGitBranch: vi.fn(),
  checkoutBranch: vi.fn(),
  createWorktree: vi.fn()
}))

vi.mock('../src/main/config-manager', () => ({
  configManager: {
    loadConfig: vi.fn(() => ({ agentCommands: {} }))
  }
}))

let detectInstalledAgents: typeof import('../src/main/agent-detector').detectInstalledAgents
let clearAgentDetectionCache: typeof import('../src/main/agent-detector').clearAgentDetectionCache

const originalEnv = process.env

describe('agent-detector', () => {
  beforeEach(async () => {
    vi.resetModules()
    execFileMock.mockClear()

    // Set a known process.env so getSafeEnv resolves from it
    process.env = {
      HOME: '/home/user',
      PATH: '/usr/local/bin:/usr/bin',
      SHELL: '/bin/zsh'
    }
    ;({ detectInstalledAgents, clearAgentDetectionCache } =
      await import('../src/main/agent-detector'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = originalEnv
  })

  it('passes shell-resolved env to which/where (the production bug)', async () => {
    // Simulate all commands being found
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '/usr/local/bin/claude\n', '')
    })

    await detectInstalledAgents()

    // Every call to execFile (which/where) must include an env option with PATH
    for (const call of execFileMock.mock.calls) {
      const opts = call[2] as Record<string, unknown>
      expect(opts).toHaveProperty('env')
      const env = opts.env as Record<string, string>
      expect(env.PATH).toBeDefined()
      expect(env.PATH).toContain('/usr/local/bin')
    }
  })

  it('uses "which" on macOS/Linux', async () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin', env: process.env })

    vi.resetModules()
    execFileMock.mockClear()
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '/usr/local/bin/claude\n', '')
    })
    ;({ detectInstalledAgents } = await import('../src/main/agent-detector'))
    await detectInstalledAgents()

    for (const call of execFileMock.mock.calls) {
      expect(call[0]).toBe('which')
    }
  })

  it('uses "where" on Windows', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32', env: process.env })

    vi.resetModules()
    execFileMock.mockClear()
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, 'C:\\Program Files\\claude\\claude.exe\n', '')
    })
    ;({ detectInstalledAgents } = await import('../src/main/agent-detector'))
    await detectInstalledAgents()

    for (const call of execFileMock.mock.calls) {
      expect(call[0]).toBe('where')
    }
  })

  it('detects installed agents when which succeeds', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '/usr/local/bin/agent\n', '')
    })

    const status = await detectInstalledAgents()

    expect(status.claude).toBe(true)
    expect(status.copilot).toBe(true)
    expect(status.codex).toBe(true)
    expect(status.opencode).toBe(true)
    expect(status.gemini).toBe(true)
  })

  it('marks agents as not installed when which fails', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      cb(err, '', '')
    })

    const status = await detectInstalledAgents()

    expect(status.claude).toBe(false)
    expect(status.copilot).toBe(false)
    expect(status.codex).toBe(false)
    expect(status.opencode).toBe(false)
    expect(status.gemini).toBe(false)
  })

  it('returns cached result on subsequent calls', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '/usr/local/bin/agent\n', '')
    })

    const first = await detectInstalledAgents()
    execFileMock.mockClear()
    const second = await detectInstalledAgents()

    expect(second).toBe(first)
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('re-detects after cache is cleared', async () => {
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '/usr/local/bin/agent\n', '')
    })

    await detectInstalledAgents()
    execFileMock.mockClear()

    clearAgentDetectionCache()

    // Now make agents "not found"
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      const err = new Error('not found') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      cb(err, '', '')
    })

    const status = await detectInstalledAgents()
    expect(status.claude).toBe(false)
    expect(execFileMock).toHaveBeenCalled()
  })

  it('does not leak sensitive env vars to which', async () => {
    vi.resetModules()
    process.env = {
      HOME: '/home/user',
      PATH: '/usr/bin',
      SHELL: '/bin/zsh',
      GITHUB_TOKEN: 'ghp_secret',
      ANTHROPIC_API_KEY: 'sk-ant-secret'
    }

    execFileMock.mockClear()
    execFileMock.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, '/usr/bin/claude\n', '')
    })
    ;({ detectInstalledAgents } = await import('../src/main/agent-detector'))

    await detectInstalledAgents()

    for (const call of execFileMock.mock.calls) {
      const env = (call[2] as Record<string, unknown>).env as Record<string, string>
      expect(env.GITHUB_TOKEN).toBeUndefined()
      expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    }
  })
})
