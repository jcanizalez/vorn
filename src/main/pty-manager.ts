import * as pty from 'node-pty'
import crypto from 'node:crypto'
import os from 'node:os'
import { BrowserWindow } from 'electron'
import { AgentType, AgentCommandConfig, CreateTerminalPayload, IPC, TerminalSession, RemoteHost } from '../shared/types'
import { getGitBranch, checkoutBranch, createWorktree } from './git-utils'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/zsh'
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

  private buildAgentLaunchLine(payload: CreateTerminalPayload): string {
    const cmd = this.agentCommands[payload.agentType] || DEFAULT_AGENT_COMMANDS[payload.agentType]
    let launchLine = [cmd.command, ...cmd.args].join(' ')
    if (payload.resumeSessionId) {
      switch (payload.agentType) {
        case 'claude':
          launchLine += ` --resume ${payload.resumeSessionId}`
          break
        case 'copilot':
          launchLine += ` --resume ${payload.resumeSessionId}`
          break
        case 'codex':
          launchLine = `${cmd.command} resume ${payload.resumeSessionId}`
          break
        case 'opencode':
          launchLine += ` --session ${payload.resumeSessionId}`
          break
      }
    }

    // Append initial prompt as CLI argument so the agent receives it
    // directly on launch (e.g. `claude "prompt"`, `codex "prompt"`).
    // This avoids fighting with interactive input key sequences.
    if (payload.initialPrompt) {
      const escaped = payload.initialPrompt.replace(/'/g, "'\\''")
      launchLine += ` '${escaped}'`
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
      env: process.env as Record<string, string>
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
      env: process.env as Record<string, string>
    })

    // Build SSH command
    const sshParts: string[] = ['ssh', '-t']
    if (host.port !== 22) sshParts.push('-p', String(host.port))
    if (host.sshKeyPath) sshParts.push('-i', host.sshKeyPath)
    if (host.sshOptions) sshParts.push(host.sshOptions)
    sshParts.push(`${host.user}@${host.hostname}`)

    // Build remote command: cd to project path then launch agent
    const agentLine = this.buildAgentLaunchLine(payload)
    const remoteCmd = `cd ${payload.projectPath} && ${agentLine}`

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
}

export const ptyManager = new PtyManager()
