import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreateSessionLog = vi.fn()
const mockUpdateSessionLog = vi.fn()
const mockAppendSessionOutput = vi.fn()
const mockListSessionLogs = vi.fn().mockReturnValue([])
const mockRegisterMethod = vi.fn()
const mockRegisterNotification = vi.fn()
const mockBroadcast = vi.fn()
const mockScheduleSave = vi.fn()

vi.mock('../packages/server/src/database', () => ({
  initDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  loadConfig: vi.fn().mockReturnValue({
    version: 1,
    defaults: { shell: '/bin/zsh', agentType: 'claude' },
    projects: [],
    tasks: []
  }),
  saveConfig: vi.fn(),
  archiveSession: vi.fn(),
  unarchiveSession: vi.fn(),
  listArchivedSessions: vi.fn().mockReturnValue([]),
  saveWorkflowRun: vi.fn(),
  listWorkflowRuns: vi.fn().mockReturnValue([]),
  listWorkflowRunsByTask: vi.fn().mockReturnValue([]),
  updateWorkflowRunStatus: vi.fn(),
  dbSaveSSHKey: vi.fn(),
  dbListSSHKeys: vi.fn().mockReturnValue([]),
  dbGetSSHKey: vi.fn(),
  dbDeleteSSHKey: vi.fn(),
  createSessionLog: (...args: unknown[]) => mockCreateSessionLog(...args),
  updateSessionLog: (...args: unknown[]) => mockUpdateSessionLog(...args),
  appendSessionOutput: (...args: unknown[]) => mockAppendSessionOutput(...args),
  listSessionLogs: (...args: unknown[]) => mockListSessionLogs(...args),
  saveSessions: vi.fn(),
  getPreviousSessions: vi.fn().mockReturnValue([])
}))

vi.mock('../packages/server/src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const { EventEmitter } = await import('node:events')

const ptyEmitter = new EventEmitter()
vi.mock('../packages/server/src/pty-manager', () => ({
  ptyManager: Object.assign(ptyEmitter, {
    getActiveSessions: vi.fn().mockReturnValue([]),
    createPty: vi.fn(),
    writeToPty: vi.fn(),
    resizePty: vi.fn(),
    closePty: vi.fn(),
    killPty: vi.fn(),
    updateSessionStatus: vi.fn()
  })
}))

const headlessEmitter = new EventEmitter()
vi.mock('../packages/server/src/headless-manager', () => ({
  headlessManager: Object.assign(headlessEmitter, {
    createHeadless: vi.fn().mockReturnValue({
      id: 'headless-1',
      pid: 999,
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test',
      branch: 'main',
      status: 'running',
      startedAt: Date.now()
    }),
    getActiveSessions: vi.fn().mockReturnValue([]),
    killHeadless: vi.fn(),
    getOutput: vi.fn().mockReturnValue([])
  })
}))

vi.mock('../packages/server/src/config-manager', () => ({
  configManager: {
    init: vi.fn(),
    loadConfig: vi.fn().mockReturnValue({
      version: 1,
      defaults: { shell: '/bin/zsh', agentType: 'claude' },
      projects: [],
      tasks: []
    }),
    saveConfig: vi.fn(),
    onConfigChanged: vi.fn(),
    notifyChanged: vi.fn()
  }
}))

vi.mock('../packages/server/src/session-persistence', () => ({
  sessionManager: {
    startAutoSave: vi.fn(),
    scheduleSave: mockScheduleSave
  }
}))

const schedulerEmitter = new EventEmitter()
vi.mock('../packages/server/src/scheduler', () => ({
  scheduler: schedulerEmitter
}))

vi.mock('../packages/server/src/schedule-log', () => ({
  scheduleLogManager: { addEntry: vi.fn(), getEntries: vi.fn().mockReturnValue([]) }
}))

vi.mock('../packages/server/src/agent-history', () => ({
  getRecentSessions: vi.fn().mockResolvedValue([])
}))

vi.mock('../packages/server/src/ide-detector', () => ({
  detectIDEs: vi.fn().mockReturnValue([]),
  openInIDE: vi.fn()
}))

vi.mock('../packages/server/src/agent-detector', () => ({
  detectInstalledAgents: vi.fn().mockReturnValue({}),
  clearAgentDetectionCache: vi.fn()
}))

vi.mock('../packages/server/src/broadcast', () => ({
  clientRegistry: {
    broadcast: mockBroadcast,
    addClient: vi.fn(),
    removeClient: vi.fn()
  }
}))

vi.mock('../packages/server/src/hook-server', () => ({
  hookServer: {
    start: vi.fn().mockResolvedValue(0),
    getPort: vi.fn().mockReturnValue(0),
    getAuthToken: vi.fn().mockReturnValue(''),
    on: vi.fn()
  }
}))

vi.mock('../packages/server/src/hook-status-mapper', () => ({
  hookStatusMapper: { mapEventToStatus: vi.fn(), forceLink: vi.fn() }
}))

vi.mock('../packages/server/src/hook-installer', () => ({
  installHooks: vi.fn()
}))

vi.mock('../packages/server/src/copilot-hook-installer', () => ({
  installCopilotHooks: vi.fn(),
  uninstallCopilotHooks: vi.fn()
}))

vi.mock('../packages/server/src/git-utils', () => ({
  getGitDiffStat: vi.fn(),
  getGitDiff: vi.fn(),
  getGitBranch: vi.fn().mockReturnValue('main'),
  gitCommit: vi.fn()
}))

vi.mock('../packages/server/src/task-images', () => ({
  saveTaskImage: vi.fn(),
  saveTaskImageFromBase64: vi.fn(),
  deleteTaskImage: vi.fn(),
  getTaskImagePath: vi.fn(),
  cleanupTaskImages: vi.fn()
}))

vi.mock('../packages/server/src/script-runner', () => ({
  executeScript: vi.fn()
}))

vi.mock('../packages/server/src/tailscale', () => ({
  getTailscaleStatus: vi.fn(),
  clearBinaryCache: vi.fn()
}))

vi.mock('../packages/server/src/process-utils', () => ({
  testSshConnection: vi.fn()
}))

vi.mock('../packages/server/src/ws-handler', () => ({
  registerMethod: (...args: unknown[]) => mockRegisterMethod(...args),
  registerNotification: (...args: unknown[]) => mockRegisterNotification(...args)
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  ptyEmitter.removeAllListeners()
  headlessEmitter.removeAllListeners()
  schedulerEmitter.removeAllListeners()
  vi.resetModules()
})

describe('session output capture', () => {
  it('registerAllMethods registers sessionLog IPC methods', async () => {
    const mod = await import('../packages/server/src/register-methods')
    mod.registerAllMethods()

    const methodNames = mockRegisterMethod.mock.calls.map((c: unknown[]) => c[0])
    expect(methodNames).toContain('sessionLog:list')
    expect(methodNames).toContain('sessionLog:update')
  })

  it('session-created with taskId calls createSessionLog', async () => {
    const mod = await import('../packages/server/src/register-methods')
    mod.registerAllMethods()

    const session = {
      id: 'sess-1',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test',
      branch: 'main',
      status: 'running',
      createdAt: Date.now(),
      pid: 123
    }
    const payload = {
      taskId: 'task-1',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test'
    }

    ptyEmitter.emit('session-created', session, payload)

    expect(mockCreateSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        sessionId: 'sess-1',
        agentType: 'claude',
        status: 'running'
      })
    )
  })

  it('session-created without taskId does not call createSessionLog', async () => {
    const mod = await import('../packages/server/src/register-methods')
    mod.registerAllMethods()

    const session = {
      id: 'sess-2',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test',
      status: 'running',
      createdAt: Date.now(),
      pid: 456
    }
    const payload = { agentType: 'claude', projectName: 'test', projectPath: '/test' }

    ptyEmitter.emit('session-created', session, payload)

    expect(mockCreateSessionLog).not.toHaveBeenCalled()
  })

  it('TERMINAL_EXIT updates session log with correct status for task-linked sessions', async () => {
    const { IPC } = await import('../packages/shared/src/types')
    const mod = await import('../packages/server/src/register-methods')
    mod.registerAllMethods()

    // Create task-linked session first
    const session = {
      id: 'sess-3',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test',
      branch: 'main',
      status: 'running',
      createdAt: Date.now(),
      pid: 789
    }
    ptyEmitter.emit('session-created', session, {
      taskId: 'task-2',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test'
    })

    // session-exit fires first (no status write), then TERMINAL_EXIT handles status
    ptyEmitter.emit('session-exit', session)
    ptyEmitter.emit('client-message', IPC.TERMINAL_EXIT, { id: 'sess-3', exitCode: 0 })

    expect(mockUpdateSessionLog).toHaveBeenCalledWith(
      'sess-3',
      expect.objectContaining({
        status: 'success',
        completedAt: expect.any(String),
        exitCode: 0
      })
    )
  })

  it('TERMINAL_EXIT sets error status for non-zero exit code', async () => {
    const { IPC } = await import('../packages/shared/src/types')
    const mod = await import('../packages/server/src/register-methods')
    mod.registerAllMethods()

    const session = {
      id: 'sess-4',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test',
      branch: 'main',
      status: 'running',
      createdAt: Date.now(),
      pid: 101
    }
    ptyEmitter.emit('session-created', session, {
      taskId: 'task-3',
      agentType: 'claude',
      projectName: 'test',
      projectPath: '/test'
    })

    ptyEmitter.emit('session-exit', session)
    ptyEmitter.emit('client-message', IPC.TERMINAL_EXIT, { id: 'sess-4', exitCode: 1 })

    expect(mockUpdateSessionLog).toHaveBeenCalledWith(
      'sess-4',
      expect.objectContaining({
        status: 'error',
        exitCode: 1
      })
    )
  })

  it('headless:create with taskId creates session log', async () => {
    const mod = await import('../packages/server/src/register-methods')
    mod.registerAllMethods()

    // Find the headless:create handler
    const headlessCreateCall = mockRegisterMethod.mock.calls.find(
      (c: unknown[]) => c[0] === 'headless:create'
    )
    expect(headlessCreateCall).toBeTruthy()

    const handler = headlessCreateCall![1]
    handler({ taskId: 'task-3', agentType: 'claude', projectName: 'test', projectPath: '/test' })

    expect(mockCreateSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-3',
        sessionId: 'headless-1',
        agentType: 'claude',
        status: 'running'
      })
    )
  })
})
