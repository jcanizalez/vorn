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
import { getGitBranch, checkoutBranch, createWorktree, extractWorktreeName } from './git-utils'
import { DEFAULT_AGENT_COMMANDS } from '@vibegrid/shared/agent-defaults'
import { buildAgentLaunchLine as buildLaunchLine } from './agent-launch'
import { shellEscape, getSafeEnv, getDefaultShell, normalizePath } from './process-utils'

import { stripAnsi } from './ansi-strip'
import { analyzeOutput, createStatusContext, StatusContext } from './status-parser'

const MAX_OUTPUT_LINES = 1000
const IDLE_TIMEOUT_MS = 5000

type WorktreeSessionCounter = (
  worktreePath: string,
  excludeId?: string
) => { count: number; sessionIds: string[] }

class PtyManager extends EventEmitter {
  private ptys = new Map<string, pty.IPty>()
  private sessions = new Map<string, TerminalSession>()
  private normalizedPaths = new Map<string, string>()
  private agentCommands: Record<AgentType, AgentCommandConfig> = { ...DEFAULT_AGENT_COMMANDS }
  private remoteHosts: RemoteHost[] = []
  private dataBuffers = new Map<string, string>()
  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private tempKeyPaths = new Map<string, string>()
  private outputLines = new Map<string, string[]>()
  private outputPartials = new Map<string, string>()
  private statusContexts = new Map<string, StatusContext>()
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private sessionOrder: string[] = []
  private headlessWorktreeCounter?: WorktreeSessionCounter

  /** Provide headless session counter to avoid circular imports */
  setHeadlessWorktreeCounter(counter: WorktreeSessionCounter): void {
    this.headlessWorktreeCounter = counter
  }

  /** Count all sessions (pty + headless) using a worktree, excluding one ID */
  private countWorktreeSessions(worktreePath: string, excludeId?: string): number {
    const pty = this.getActiveSessionsForWorktree(worktreePath, excludeId)
    const headless = this.headlessWorktreeCounter?.(worktreePath, excludeId) ?? {
      count: 0,
      sessionIds: []
    }
    return pty.count + headless.count
  }

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
    let worktreeName: string | undefined
    let effectiveBranch: string | undefined

    if (payload.existingWorktreePath && fs.existsSync(payload.existingWorktreePath)) {
      effectivePath = payload.existingWorktreePath
      worktreePath = payload.existingWorktreePath
      worktreeName = payload.worktreeName || extractWorktreeName(payload.existingWorktreePath)
      effectiveBranch = payload.branch
    } else if ((payload.useWorktree || payload.existingWorktreePath) && payload.branch) {
      if (payload.existingWorktreePath) {
        log.warn(
          `[pty] worktree path no longer exists, creating new: ${payload.existingWorktreePath}`
        )
      }
      const result = createWorktree(payload.projectPath, payload.branch, payload.worktreeName)
      effectivePath = result.worktreePath
      worktreePath = result.worktreePath
      worktreeName = result.name
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

    // Per-agent hookSessionId strategy:
    //   Claude:       generate UUID → pass --session-id → stored as hookSessionId immediately
    //   Copilot:      UUID injected into hooks.json by copilot-hook-installer; forceLink sets hookSessionId
    //   Codex/OpenCode: no CLI support for session ID pinning; hookSessionId stays undefined,
    //                   restore relies on history-based fallback in resolveResumeSessionId
    //   Gemini:       no resume support (supportsExactSessionResume returns false)
    let hookSessionId: string | undefined
    if (payload.agentType === 'claude') {
      if (payload.resumeSessionId) {
        hookSessionId = payload.resumeSessionId
      } else {
        hookSessionId = crypto.randomUUID()
        payload.sessionId = hookSessionId
      }
    }

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
      ...(worktreePath ? { worktreePath, worktreeName, isWorktree: true } : {}),
      ...(hookSessionId ? { hookSessionId, statusSource: 'hooks' as const } : {})
    }
    this.sessions.set(id, session)
    this.sessionOrder.push(id)
    this.normalizedPaths.set(id, normalizePath(worktreePath || payload.projectPath))
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
    this.sessionOrder.push(id)
    this.normalizedPaths.set(id, normalizePath(payload.projectPath))
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

  private clearSessionTracking(id: string): void {
    this.outputLines.delete(id)
    this.outputPartials.delete(id)
    this.statusContexts.delete(id)
    const idleTimer = this.idleTimers.get(id)
    if (idleTimer) clearTimeout(idleTimer)
    this.idleTimers.delete(id)
  }

  private appendOutput(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session) return // skip shell-only PTYs

    let buf = this.outputLines.get(id)
    if (!buf) {
      buf = []
      this.outputLines.set(id, buf)
    }

    const clean = stripAnsi(data)
    const partial = this.outputPartials.get(id) ?? ''
    const combined = partial + clean
    const segments = combined.split('\n')

    // Last segment is incomplete (no trailing \n) — save for next chunk
    this.outputPartials.set(id, segments.pop()!)

    for (const line of segments) {
      buf.push(line)
    }
    if (buf.length > MAX_OUTPUT_LINES) {
      buf.splice(0, buf.length - MAX_OUTPUT_LINES)
    }

    // Pattern-based status detection for non-hook sessions
    if (session.statusSource !== 'hooks') {
      let ctx = this.statusContexts.get(id)
      if (!ctx) {
        ctx = createStatusContext()
        this.statusContexts.set(id, ctx)
      }
      const newStatus = analyzeOutput(ctx, clean)
      if (newStatus !== session.status) {
        this.updateSessionStatus(id, newStatus)
      }

      // Reset idle timer — if no data arrives for IDLE_TIMEOUT_MS, mark idle
      const existingTimer = this.idleTimers.get(id)
      if (existingTimer) clearTimeout(existingTimer)
      this.idleTimers.set(
        id,
        setTimeout(() => {
          this.idleTimers.delete(id)
          const s = this.sessions.get(id)
          if (s && s.statusSource !== 'hooks' && s.status === 'running') {
            this.updateSessionStatus(id, 'idle')
          }
        }, IDLE_TIMEOUT_MS)
      )
    }
  }

  private setupPtyEvents(id: string, ptyProcess: pty.IPty): void {
    ptyProcess.onData((data: string) => {
      this.bufferData(id, data)
      this.appendOutput(id, data)
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
      this.clearSessionTracking(id)
      this.sessionOrder = this.sessionOrder.filter((sid) => sid !== id)

      this.ptys.delete(id)
      const session = this.sessions.get(id)
      if (session) {
        this.emit('session-exit', session)
        session.status = 'idle'
        if (session.worktreePath) {
          // Only prompt cleanup when this is the last session using the worktree
          const remaining = this.countWorktreeSessions(session.worktreePath, session.id)
          if (remaining === 0) {
            this.emit('client-message', IPC.WORKTREE_CONFIRM_CLEANUP, {
              id: session.id,
              projectPath: session.projectPath,
              worktreePath: session.worktreePath
            })
          }
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
    this.normalizedPaths.delete(id)
    this.clearSessionTracking(id)
    this.sessionOrder = this.sessionOrder.filter((sid) => sid !== id)
    this.ptys.delete(id)

    if (session) {
      this.emit('session-exit', session)
      if (session.worktreePath) {
        // Session already removed from map — count remaining sessions
        const remaining = this.countWorktreeSessions(session.worktreePath)
        if (remaining === 0) {
          this.emit('client-message', IPC.WORKTREE_CONFIRM_CLEANUP, {
            id: session.id,
            projectPath: session.projectPath,
            worktreePath: session.worktreePath
          })
        }
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
    this.outputLines.clear()
    this.outputPartials.clear()
    this.statusContexts.clear()
    for (const timer of this.idleTimers.values()) clearTimeout(timer)
    this.idleTimers.clear()
    this.sessionOrder = []
  }

  getActiveSessions(): TerminalSession[] {
    if (this.sessionOrder.length === 0) {
      return Array.from(this.sessions.values())
    }
    const ordered: TerminalSession[] = []
    const seen = new Set<string>()
    for (const id of this.sessionOrder) {
      const s = this.sessions.get(id)
      if (s) {
        ordered.push(s)
        seen.add(id)
      }
    }
    for (const s of this.sessions.values()) {
      if (!seen.has(s.id)) ordered.push(s)
    }
    return ordered
  }

  updateSessionStatus(id: string, status: AgentStatus): void {
    const session = this.sessions.get(id)
    if (session && session.status !== status) {
      session.status = status
      this.emit('client-message', IPC.SESSION_UPDATED, session)
    }
  }

  renameSession(id: string, displayName: string): void {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`Session not found: ${id}`)
    session.displayName = displayName
    this.emit('client-message', IPC.SESSION_UPDATED, session)
  }

  reorderSessions(ids: string[]): void {
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate session IDs')
    for (const id of ids) {
      if (!this.sessions.has(id)) throw new Error(`Session not found: ${id}`)
    }
    this.sessionOrder = ids
    this.emit('client-message', IPC.SESSION_REORDERED, ids)
  }

  getOutput(id: string, lines?: number): string[] {
    if (!this.sessions.has(id)) throw new Error(`Session not found: ${id}`)
    const buf = this.outputLines.get(id) ?? []
    if (lines && lines < buf.length) {
      return buf.slice(-lines)
    }
    return [...buf]
  }

  getActiveSessionsForWorktree(
    worktreePath: string,
    excludeId?: string
  ): { count: number; sessionIds: string[] } {
    const sessionIds: string[] = []
    for (const s of this.sessions.values()) {
      if (s.worktreePath === worktreePath && s.status !== 'idle' && s.id !== excludeId) {
        sessionIds.push(s.id)
      }
    }
    return { count: sessionIds.length, sessionIds }
  }

  updateSessionsForWorktree(
    worktreePath: string,
    updates: { branch?: string; worktreePath?: string; worktreeName?: string }
  ): void {
    for (const s of this.sessions.values()) {
      if (s.worktreePath === worktreePath) {
        if (updates.branch !== undefined) s.branch = updates.branch
        if (updates.worktreeName !== undefined) s.worktreeName = updates.worktreeName
        if (updates.worktreePath !== undefined) s.worktreePath = updates.worktreePath
        this.emit('client-message', IPC.SESSION_UPDATED, s)
      }
    }
  }

  /**
   * Finds the most-recently-created terminal matching cwd that:
   * - is NOT already linked to a Claude session (no hookSessionId)
   * - is NOT in the excludeIds set (already claimed by another session_id)
   */
  findUnlinkedSessionByCwd(cwd: string, excludeIds: Set<string>): TerminalSession | undefined {
    const normalizedCwd = normalizePath(cwd)
    let best: TerminalSession | undefined
    let bestTime = 0

    for (const session of this.sessions.values()) {
      if (session.hookSessionId) continue // already linked
      if (excludeIds.has(session.id)) continue
      const sessionPath =
        this.normalizedPaths.get(session.id) ??
        normalizePath(session.worktreePath || session.projectPath)
      if (sessionPath === normalizedCwd && session.createdAt > bestTime) {
        best = session
        bestTime = session.createdAt
      }
    }

    return best
  }
}

export const ptyManager = new PtyManager()
