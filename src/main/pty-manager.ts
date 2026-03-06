import * as pty from 'node-pty'
import crypto from 'node:crypto'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { BrowserWindow } from 'electron'
import { AgentType, AgentStatus, AgentCommandConfig, CreateTerminalPayload, IPC, TerminalSession, RemoteHost } from '../shared/types'
import { getGitBranch, checkoutBranch, createWorktree } from './git-utils'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'

function commandExists(cmd: string): boolean {
  try {
    const bin = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(bin, [cmd], { stdio: 'pipe', timeout: 3000 })
    return true
  } catch {
    return false
  }
}

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/zsh'
}

export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

const SENSITIVE_ENV_PREFIXES = [
  'AWS_SECRET', 'AWS_SESSION', 'GITHUB_TOKEN', 'GH_TOKEN', 'OPENAI_API',
  'ANTHROPIC_API', 'GOOGLE_API', 'STRIPE_', 'DATABASE_URL', 'DB_PASSWORD',
  'SECRET_', 'PRIVATE_KEY', 'NPM_TOKEN', 'NODE_AUTH_TOKEN'
]

export function getSafeEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, val] of Object.entries(process.env)) {
    if (val === undefined) continue
    if (SENSITIVE_ENV_PREFIXES.some((p) => key.toUpperCase().startsWith(p))) continue
    env[key] = val
  }
  return env
}

class PtyManager {
  private ptys = new Map<string, pty.IPty>()
  private sessions = new Map<string, TerminalSession>()
  private mainWindow: BrowserWindow | null = null
  private agentCommands: Record<AgentType, AgentCommandConfig> = { ...DEFAULT_AGENT_COMMANDS }
  private remoteHosts: RemoteHost[] = []

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  setRemoteHosts(hosts: RemoteHost[]): void {
    this.remoteHosts = hosts
  }

  setAgentCommands(overrides?: Partial<Record<AgentType, AgentCommandConfig>>): void {
    this.agentCommands = { ...DEFAULT_AGENT_COMMANDS }
    if (overrides) {
      for (const [key, val] of Object.entries(overrides)) {
        if (val) {
          this.agentCommands[key as AgentType] = val
        }
      }
    }
  }

  private resolveAgentCommand(config: AgentCommandConfig): { command: string; args: string[] } {
    if (commandExists(config.command)) {
      return { command: config.command, args: config.args }
    }
    if (config.fallbackCommand && commandExists(config.fallbackCommand)) {
      return { command: config.fallbackCommand, args: config.fallbackArgs ?? [] }
    }
    // Return original even if not found — let it fail visibly in the terminal
    return { command: config.command, args: config.args }
  }

  private buildAgentLaunchLine(payload: CreateTerminalPayload): string {
    const cmdConfig = this.agentCommands[payload.agentType] || DEFAULT_AGENT_COMMANDS[payload.agentType]
    const cmd = this.resolveAgentCommand(cmdConfig)
    let launchLine = [cmd.command, ...cmd.args].join(' ')
    if (payload.resumeSessionId) {
      switch (payload.agentType) {
        case 'claude':   // claude --resume <sessionId>
          launchLine += ` --resume ${payload.resumeSessionId}`
          break
        case 'copilot':  // gh copilot --resume <sessionId>
          launchLine += ` --resume ${payload.resumeSessionId}`
          break
        case 'codex':    // codex resume <sessionId>
          launchLine = `${cmd.command} resume ${payload.resumeSessionId}`
          break
        case 'opencode': // opencode --session <sessionId>
          launchLine += ` --session ${payload.resumeSessionId}`
          break
        case 'gemini':   // gemini --resume latest (no UUID support, index-based)
          launchLine += ` --resume latest`
          break
      }
    }

    // Append initial prompt as CLI argument
    if (payload.initialPrompt) {
      const escaped = payload.initialPrompt.replace(/'/g, "'\\''")
      switch (payload.agentType) {
        case 'copilot':  // gh copilot -i "prompt" (interactive + auto-execute)
          launchLine += ` -i '${escaped}'`
          break
        case 'gemini':   // gemini -i "prompt" (interactive + auto-execute)
          launchLine += ` -i '${escaped}'`
          break
        case 'opencode': // opencode --prompt "prompt"
          launchLine += ` --prompt '${escaped}'`
          break
        default:         // claude "prompt", codex "prompt" (positional)
          launchLine += ` '${escaped}'`
          break
      }
    }

    return launchLine
  }

  createPty(payload: CreateTerminalPayload): TerminalSession {
    const id = crypto.randomUUID()
    const shell = getDefaultShell()

    // Check if this is a remote session
    const remoteHost = payload.remoteHostId
      ? this.remoteHosts.find((h) => h.id === payload.remoteHostId)
      : undefined

    if (remoteHost) {
      return this.createRemotePty(id, shell, payload, remoteHost)
    }

    return this.createLocalPty(id, shell, payload)
  }

  private createLocalPty(id: string, shell: string, payload: CreateTerminalPayload): TerminalSession {
    let effectivePath = payload.projectPath
    let worktreePath: string | undefined
    let effectiveBranch: string | undefined

    // Handle worktree creation
    if (payload.useWorktree && payload.branch) {
      const result = createWorktree(payload.projectPath, payload.branch)
      effectivePath = result.worktreePath
      worktreePath = result.worktreePath
      effectiveBranch = result.branch
    }
    // Handle branch checkout (no worktree)
    else if (payload.branch) {
      const currentBranch = getGitBranch(payload.projectPath)
      if (currentBranch !== payload.branch) {
        checkoutBranch(payload.projectPath, payload.branch)
      }
      effectiveBranch = payload.branch
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: effectivePath,
      env: getSafeEnv()
    })

    const launchLine = this.buildAgentLaunchLine(payload)
    setTimeout(() => ptyProcess.write(launchLine + '\r'), 300)

    this.setupPtyEvents(id, ptyProcess)
    this.ptys.set(id, ptyProcess)

    const branch = effectiveBranch || getGitBranch(effectivePath)
    const session: TerminalSession = {
      id,
      agentType: payload.agentType,
      projectName: payload.projectName,
      projectPath: payload.projectPath,
      status: 'running',
      createdAt: Date.now(),
      pid: ptyProcess.pid,
      ...(payload.displayName ? { displayName: payload.displayName } : {}),
      ...(branch ? { branch } : {}),
      ...(worktreePath ? { worktreePath, isWorktree: true } : {})
    }
    this.sessions.set(id, session)
    return session
  }

  private createRemotePty(id: string, shell: string, payload: CreateTerminalPayload, host: RemoteHost): TerminalSession {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: getSafeEnv()
    })

    // Build SSH command
    const sshParts: string[] = ['ssh', '-t']
    if (host.port !== 22) sshParts.push('-p', String(host.port))
    if (host.sshKeyPath) sshParts.push('-i', host.sshKeyPath)
    if (host.sshOptions) {
      const opts = host.sshOptions.split(/\s+/).filter(Boolean)
      sshParts.push(...opts)
    }
    sshParts.push(`${host.user}@${host.hostname}`)

    // Build remote command: cd to project path then launch agent
    const agentLine = this.buildAgentLaunchLine(payload)
    const remoteCmd = `cd ${shellEscape(payload.projectPath)} && ${agentLine}`

    // Write SSH command, then detect prompt and send the agent command
    setTimeout(() => ptyProcess.write(sshParts.join(' ') + '\r'), 300)

    let connected = false
    const fallbackTimer = setTimeout(() => {
      if (!connected) {
        connected = true
        ptyProcess.write(remoteCmd + '\r')
      }
    }, 5000)

    const promptListener = ptyProcess.onData((data: string) => {
      if (!connected && /[$#>]\s*$/.test(data)) {
        connected = true
        clearTimeout(fallbackTimer)
        setTimeout(() => ptyProcess.write(remoteCmd + '\r'), 100)
      }
    })

    // Replace the prompt listener with the normal forwarding once connected
    // We still need to forward all data to the renderer from the start
    this.setupPtyEvents(id, ptyProcess)
    this.ptys.set(id, ptyProcess)

    // Clean up the prompt listener after connection or timeout
    const cleanup = (): void => { promptListener.dispose() }
    const checkConnected = setInterval(() => {
      if (connected) { cleanup(); clearInterval(checkConnected) }
    }, 200)
    setTimeout(() => { cleanup(); clearInterval(checkConnected) }, 6000)

    const session: TerminalSession = {
      id,
      agentType: payload.agentType,
      projectName: payload.projectName,
      projectPath: payload.projectPath,
      status: 'running',
      createdAt: Date.now(),
      pid: ptyProcess.pid,
      remoteHostId: host.id,
      remoteHostLabel: host.label,
      ...(payload.displayName ? { displayName: payload.displayName } : {})
    }
    this.sessions.set(id, session)
    return session
  }

  private sendToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args)
    }
  }

  private setupPtyEvents(id: string, ptyProcess: pty.IPty): void {
    ptyProcess.onData((data: string) => {
      this.sendToRenderer(IPC.TERMINAL_DATA, { id, data })
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.ptys.delete(id)
      const session = this.sessions.get(id)
      if (session) {
        session.status = 'idle'
        if (session.worktreePath) {
          this.sendToRenderer(IPC.WORKTREE_CONFIRM_CLEANUP, {
            id: session.id,
            projectPath: session.projectPath,
            worktreePath: session.worktreePath
          })
        }
      }
      this.sendToRenderer(IPC.TERMINAL_EXIT, { id, exitCode })
    })
  }

  writeToPty(id: string, data: string): void {
    this.ptys.get(id)?.write(data)
  }

  resizePty(id: string, cols: number, rows: number): void {
    this.ptys.get(id)?.resize(cols, rows)
  }

  killPty(id: string): void {
    const p = this.ptys.get(id)
    const session = this.sessions.get(id)
    if (session?.worktreePath) {
      this.mainWindow?.webContents.send(IPC.WORKTREE_CONFIRM_CLEANUP, {
        id: session.id,
        projectPath: session.projectPath,
        worktreePath: session.worktreePath
      })
    }
    if (p) {
      p.kill()
      this.ptys.delete(id)
      this.sessions.delete(id)
    }
  }

  killAll(): void {
    this.mainWindow = null
    for (const [id, p] of this.ptys) {
      p.kill()
      this.ptys.delete(id)
    }
    this.sessions.clear()
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values())
  }

  updateSessionStatus(id: string, status: AgentStatus): void {
    const session = this.sessions.get(id)
    if (session) {
      session.status = status
      this.sendToRenderer(IPC.TERMINAL_DATA, { id, data: '' }) // trigger widget update
    }
  }

  /**
   * Finds the most-recently-created terminal matching cwd that:
   * - is NOT already linked to a Claude session (no hookSessionId)
   * - is NOT in the excludeIds set (already claimed by another session_id)
   */
  findUnlinkedSessionByCwd(cwd: string, excludeIds: Set<string>): TerminalSession | undefined {
    const normalizedCwd = cwd.replace(/\/+$/, '')
    let best: TerminalSession | undefined
    let bestTime = 0

    for (const session of this.sessions.values()) {
      if (session.hookSessionId) continue // already linked
      if (excludeIds.has(session.id)) continue
      const sessionPath = (session.worktreePath || session.projectPath).replace(/\/+$/, '')
      if (sessionPath === normalizedCwd && session.createdAt > bestTime) {
        best = session
        bestTime = session.createdAt
      }
    }

    return best
  }
}

export const ptyManager = new PtyManager()
