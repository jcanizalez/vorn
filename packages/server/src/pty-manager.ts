import * as pty from 'node-pty'
import crypto from 'node:crypto'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import log from './logger'
import {
  AgentType,
  AgentStatus,
  AgentCommandConfig,
  CreateTerminalPayload,
  IPC,
  TerminalSession,
  RemoteHost
} from '@vibegrid/shared/types'
import { getGitBranch, checkoutBranch, createWorktree } from './git-utils'
import { DEFAULT_AGENT_COMMANDS } from '@vibegrid/shared/agent-defaults'
import { buildAgentLaunchLine as buildLaunchLine } from './agent-launch'
import { shellEscape, getSafeEnv, getDefaultShell } from './process-utils'

class PtyManager extends EventEmitter {
  private ptys = new Map<string, pty.IPty>()
  private sessions = new Map<string, TerminalSession>()
  private agentCommands: Record<AgentType, AgentCommandConfig> = { ...DEFAULT_AGENT_COMMANDS }
  private remoteHosts: RemoteHost[] = []
  private dataBuffers = new Map<string, string>()
  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private tempKeyPaths = new Map<string, string>()

  constructor() {
    super()
    setImmediate(() => this.cleanStaleTempKeys())
  }

  /** Remove stale temp key files from previous crashes (older than 1 hour) */
  private cleanStaleTempKeys(): void {
    try {
      const tmpDir = os.tmpdir()
      const files = fs.readdirSync(tmpDir)
      const now = Date.now()
      for (const f of files) {
        if (!f.startsWith('vibegrid-key-')) continue
        const fullPath = path.join(tmpDir, f)
        try {
          const stat = fs.statSync(fullPath)
          if (now - stat.mtimeMs > 3600_000) {
            fs.unlinkSync(fullPath)
            log.info(`[pty] cleaned stale temp key: ${f}`)
          }
        } catch {
          /* ignore individual file errors */
        }
      }
    } catch {
      /* tmpdir read failed, not critical */
    }
  }

  private deleteTempKey(sessionId: string): void {
    const keyPath = this.tempKeyPaths.get(sessionId)
    if (keyPath) {
      try {
        fs.unlinkSync(keyPath)
      } catch {
        /* already deleted */
      }
      this.tempKeyPaths.delete(sessionId)
    }
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
    return buildLaunchLine(payload, this.agentCommands, getSafeEnv())
  }

  createPty(payload: CreateTerminalPayload): TerminalSession {
    const id = crypto.randomUUID()
    const shell = getDefaultShell()

    // Check if this is a remote session
    const remoteHost = payload.remoteHostId
      ? this.remoteHosts.find((h) => h.id === payload.remoteHostId)
      : undefined

    const session = remoteHost
      ? this.createRemotePty(id, shell, payload, remoteHost)
      : this.createLocalPty(id, shell, payload)

    this.emit('session-created', session, payload)
    return session
  }

  private createLocalPty(
    id: string,
    shell: string,
    payload: CreateTerminalPayload
  ): TerminalSession {
    let effectivePath = payload.projectPath
    let worktreePath: string | undefined
    let effectiveBranch: string | undefined

    // Reuse existing worktree
    if (payload.existingWorktreePath) {
      effectivePath = payload.existingWorktreePath
      worktreePath = payload.existingWorktreePath
      effectiveBranch = payload.branch
    }
    // Handle worktree creation
    else if (payload.useWorktree && payload.branch) {
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

    const ptyProcess = pty.spawn(shell, ['-l'], {
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

  private createRemotePty(
    id: string,
    shell: string,
    payload: CreateTerminalPayload,
    host: RemoteHost
  ): TerminalSession {
    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: getSafeEnv()
    })

    // Build SSH command based on auth method, with a ready marker for reliable prompt detection
    const marker = `__VIBEGRID_READY_${id.slice(0, 8)}__`
    const sshParts: string[] = ['ssh', '-t']
    if (host.port !== 22) sshParts.push('-p', String(host.port))

    const authMethod = host.authMethod ?? 'agent'

    if (authMethod === 'key-file' && host.sshKeyPath) {
      sshParts.push('-i', host.sshKeyPath)
    } else if (authMethod === 'key-stored' && !payload._decryptedKeyContent) {
      log.warn(
        `[pty] key-stored auth selected for host ${host.label} but no decrypted key available — falling back to agent`
      )
    } else if (authMethod === 'key-stored' && payload._decryptedKeyContent) {
      // Write decrypted key to a temp file (mode 0600)
      const tmpKeyPath = path.join(os.tmpdir(), `vibegrid-key-${crypto.randomUUID()}`)
      fs.writeFileSync(tmpKeyPath, payload._decryptedKeyContent, { mode: 0o600 })
      this.tempKeyPaths.set(id, tmpKeyPath)
      sshParts.push('-i', tmpKeyPath)
    } else if (authMethod === 'password') {
      sshParts.push('-o', 'PreferredAuthentications=password')
      sshParts.push('-o', 'PubkeyAuthentication=no')
    }
    // 'agent' auth: no extra flags, rely on ssh-agent

    if (host.sshOptions) {
      const opts = host.sshOptions.split(/\s+/).filter(Boolean)
      sshParts.push(...opts)
    }
    sshParts.push(`${host.user}@${host.hostname}`)
    // Echo a unique marker on connect, then exec a login shell so the session stays alive.
    // Single-quoted so the local shell passes && and $SHELL literally to SSH,
    // which forwards them to the remote shell for interpretation.
    sshParts.push(`'echo ${marker} && exec $SHELL -l'`)

    // Build remote command: cd to project path then launch agent
    const agentLine = this.buildAgentLaunchLine(payload)
    const remoteCmd = `cd ${shellEscape(payload.projectPath)} && ${agentLine}`

    // Write SSH command after local shell is ready
    setTimeout(() => {
      if (this.ptys.has(id)) ptyProcess.write(sshParts.join(' ') + '\r')
    }, 300)

    // Password prompt auto-detection
    if (authMethod === 'password' && payload._decryptedPassword) {
      let passwordSent = false
      const pwListener = ptyProcess.onData((data: string) => {
        if (!passwordSent && /[Pp]ass(word|phrase)[^:]*:\s*$/.test(data)) {
          passwordSent = true
          setTimeout(() => {
            if (this.ptys.has(id)) ptyProcess.write(payload._decryptedPassword + '\r')
          }, 50)
        }
      })
      setTimeout(() => pwListener.dispose(), 15_000)
    }

    // Clear transient credentials from payload
    delete payload._decryptedKeyContent
    delete payload._decryptedPassword

    let connected = false
    let sshOutput = ''

    // Fallback: if marker never arrives (non-standard shell), send command after timeout
    const fallbackTimer = setTimeout(() => {
      if (!connected) {
        connected = true
        log.warn(`[pty] SSH marker not detected for ${id}, using fallback`)
        if (this.ptys.has(id)) ptyProcess.write(remoteCmd + '\r')
        this.deleteTempKey(id)
      }
    }, 8000)

    const promptListener = ptyProcess.onData((data: string) => {
      if (connected) return
      sshOutput += data

      // Primary: detect our unique marker
      if (sshOutput.includes(marker)) {
        connected = true
        clearTimeout(fallbackTimer)
        // Small delay to let the login shell fully initialize
        setTimeout(() => {
          if (this.ptys.has(id)) ptyProcess.write(remoteCmd + '\r')
          this.deleteTempKey(id)
        }, 200)
        return
      }

      // Detect SSH errors early to avoid waiting for full timeout
      const errorPatterns = [
        'Permission denied',
        'Connection refused',
        'Connection timed out',
        'Could not resolve hostname',
        'No route to host',
        'Connection closed',
        'Host key verification failed'
      ]
      for (const pattern of errorPatterns) {
        if (sshOutput.includes(pattern)) {
          log.error(`[pty] SSH connection error for ${id}: ${pattern}`)
          clearTimeout(fallbackTimer)
          this.deleteTempKey(id)
          // Don't set connected — let the PTY show the error to the user
          return
        }
      }
    })

    // Forward all data to the renderer from the start
    this.setupPtyEvents(id, ptyProcess)
    this.ptys.set(id, ptyProcess)

    // Clean up the prompt listener after connection or timeout
    const cleanup = (): void => {
      promptListener.dispose()
    }
    const checkConnected = setInterval(() => {
      if (connected) {
        cleanup()
        clearInterval(checkConnected)
      }
    }, 200)
    setTimeout(() => {
      cleanup()
      clearInterval(checkConnected)
    }, 10000)

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

  createShellPty(cwd?: string): { id: string; pid: number } {
    const id = crypto.randomUUID()
    const shell = getDefaultShell()
    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || os.homedir(),
      env: getSafeEnv()
    })
    this.setupPtyEvents(id, ptyProcess)
    this.ptys.set(id, ptyProcess)
    return { id, pid: ptyProcess.pid }
  }

  private static readonly BUFFER_FLUSH_MS = 8

  private bufferData(id: string, data: string): void {
    const existing = this.dataBuffers.get(id)
    this.dataBuffers.set(id, existing ? existing + data : data)

    if (!this.flushTimers.has(id)) {
      this.flushTimers.set(
        id,
        setTimeout(() => this.flushBuffer(id), PtyManager.BUFFER_FLUSH_MS)
      )
    }
  }

  private flushBuffer(id: string): void {
    const data = this.dataBuffers.get(id)
    this.dataBuffers.delete(id)
    this.flushTimers.delete(id)
    if (data) {
      this.emit('client-message', IPC.TERMINAL_DATA, { id, data })
    }
  }

  private clearBuffer(id: string): void {
    const timer = this.flushTimers.get(id)
    if (timer) clearTimeout(timer)
    this.flushTimers.delete(id)
    this.dataBuffers.delete(id)
  }

  private setupPtyEvents(id: string, ptyProcess: pty.IPty): void {
    ptyProcess.onData((data: string) => {
      this.bufferData(id, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      // Flush any remaining buffered data before signaling exit
      const pendingTimer = this.flushTimers.get(id)
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        this.flushBuffer(id)
      }
      this.clearBuffer(id)
      this.deleteTempKey(id)

      this.ptys.delete(id)
      const session = this.sessions.get(id)
      if (session) {
        this.emit('session-exit', session)
        session.status = 'idle'
        if (session.worktreePath) {
          this.emit('client-message', IPC.WORKTREE_CONFIRM_CLEANUP, {
            id: session.id,
            projectPath: session.projectPath,
            worktreePath: session.worktreePath
          })
        }
      }
      this.emit('client-message', IPC.TERMINAL_EXIT, { id, exitCode })
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

    // Flush any remaining buffered data before killing
    const pendingTimer = this.flushTimers.get(id)
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      this.flushBuffer(id)
    }
    this.clearBuffer(id)

    // Delete session and PTY from maps BEFORE killing so the onExit handler
    // (setupPtyEvents) won't find them and emit a duplicate 'session-exit'.
    // Delete-then-check pattern: single removal point prevents races.
    const session = this.sessions.get(id)
    this.sessions.delete(id)
    this.ptys.delete(id)

    if (session) {
      this.emit('session-exit', session)
      if (session.worktreePath) {
        this.emit('client-message', IPC.WORKTREE_CONFIRM_CLEANUP, {
          id: session.id,
          projectPath: session.projectPath,
          worktreePath: session.worktreePath
        })
      }
    }
    if (p) {
      // Defer the actual kill so the IPC response returns immediately.
      // All state cleanup is already done above, so the renderer can proceed
      // without waiting for the process to die (avoids UI freeze on Windows
      // where conpty termination can block the event loop).
      setImmediate(() => {
        try {
          p.kill()
        } catch (err) {
          log.warn(`[pty] kill failed for ${id} (already dead?):`, err)
        }
      })
    } else {
      // Surface an exit event even if the PTY was already gone so the
      // renderer can complete any close-intent cleanup.
      this.emit('client-message', IPC.TERMINAL_EXIT, { id, exitCode: 0 })
    }
  }

  killAll(): void {
    // Clear all data buffers and flush timers (window is closing, no point flushing)
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer)
    }
    this.dataBuffers.clear()
    this.flushTimers.clear()

    // Clean up any remaining temp key files
    for (const sessionId of this.tempKeyPaths.keys()) {
      this.deleteTempKey(sessionId)
    }

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
      this.emit('client-message', IPC.TERMINAL_DATA, { id, data: '' }) // trigger widget update
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
