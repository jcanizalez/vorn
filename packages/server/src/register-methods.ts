import crypto from 'node:crypto'
import { registerMethod, registerNotification } from './ws-handler'
import { ptyManager } from './pty-manager'
import { headlessManager } from './headless-manager'
import { configManager } from './config-manager'
import { sessionManager } from './session-persistence'
import { scheduler } from './scheduler'
import { scheduleLogManager } from './schedule-log'
import { getRecentSessions } from './agent-history'
import { detectIDEs, openInIDE } from './ide-detector'
import { detectInstalledAgents, clearAgentDetectionCache } from './agent-detector'
import { clientRegistry } from './broadcast'
import { hookServer } from './hook-server'
import { hookStatusMapper } from './hook-status-mapper'
import { installHooks } from './hook-installer'
import {
  installCopilotHooks,
  uninstallCopilotHooks,
  CopilotHookInstallation
} from './copilot-hook-installer'
import { IPC, WidgetAgentInfo, PermissionRequestInfo } from '@vibegrid/shared/types'
import * as gitUtils from './git-utils'
import {
  saveTaskImage,
  saveTaskImageFromBase64,
  deleteTaskImage,
  getTaskImagePath,
  cleanupTaskImages
} from './task-images'
import {
  archiveSession,
  unarchiveSession,
  listArchivedSessions,
  saveWorkflowRun,
  listWorkflowRuns,
  listWorkflowRunsByTask,
  updateWorkflowRunStatus,
  dbSaveSSHKey,
  dbListSSHKeys,
  dbGetSSHKey,
  dbDeleteSSHKey,
  createSessionLog,
  updateSessionLog,
  appendSessionOutput,
  listSessionLogs
} from './database'
import { executeScript } from './script-runner'
import { getTailscaleStatus, clearBinaryCache } from './tailscale'
import { checkAndRebind } from './server-rebind'
import { testSshConnection } from './process-utils'
import log from './logger'

const copilotInstallations = new Map<string, CopilotHookInstallation>()

const taskLinkedSessions = new Map<string, string>() // sessionId → taskId
const outputBuffers = new Map<string, string[]>() // sessionId → buffered chunks
const OUTPUT_FLUSH_INTERVAL = 5_000
let outputFlushTimer: ReturnType<typeof setInterval> | null = null

function startOutputFlush(): void {
  if (outputFlushTimer) return
  outputFlushTimer = setInterval(() => {
    for (const [sessionId, chunks] of outputBuffers) {
      if (chunks.length > 0) {
        try {
          appendSessionOutput(sessionId, chunks.join(''))
        } catch (err) {
          log.error('[session-logs] failed to flush output:', err)
        }
        outputBuffers.set(sessionId, [])
      }
    }
  }, OUTPUT_FLUSH_INTERVAL)
}

function stopOutputFlushIfIdle(): void {
  if (taskLinkedSessions.size === 0 && outputFlushTimer) {
    clearInterval(outputFlushTimer)
    outputFlushTimer = null
  }
}

function bufferSessionOutput(sessionId: string, data: string): void {
  const chunks = outputBuffers.get(sessionId)
  if (chunks) chunks.push(data)
}

function linkSessionToTask(
  sessionId: string,
  taskId: string,
  session: { agentType?: string; branch?: string; projectName?: string }
): void {
  createSessionLog({
    taskId,
    sessionId,
    agentType: session.agentType,
    branch: session.branch,
    status: 'running',
    startedAt: new Date().toISOString(),
    projectName: session.projectName
  })
  taskLinkedSessions.set(sessionId, taskId)
  outputBuffers.set(sessionId, [])
  startOutputFlush()
  log.info(`[session-logs] linked task "${taskId}" to session ${sessionId}`)
}

function flushAndCleanup(sessionId: string): void {
  const chunks = outputBuffers.get(sessionId)
  if (chunks && chunks.length > 0) {
    try {
      appendSessionOutput(sessionId, chunks.join(''))
    } catch (err) {
      log.error('[session-logs] failed to flush output on exit:', err)
    }
  }
  outputBuffers.delete(sessionId)
  taskLinkedSessions.delete(sessionId)
  stopOutputFlushIfIdle()
}

let serverPort = 0
export function setServerPort(port: number): void {
  serverPort = port
}

export function registerAllMethods(): void {
  // Terminal
  registerMethod('terminal:create', (payload) => {
    return ptyManager.createPty(payload)
  })
  registerMethod('terminal:kill', (id) => ptyManager.killPty(id))
  registerMethod('terminal:listActive', () => ptyManager.getActiveSessions())
  registerMethod('terminal:rename', ({ id, displayName }) =>
    ptyManager.renameSession(id, displayName)
  )
  registerMethod('terminal:reorder', (ids) => ptyManager.reorderSessions(ids))
  registerMethod('terminal:readOutput', ({ id, lines }) => ptyManager.getOutput(id, lines))
  registerMethod('shell:create', (cwd) => ptyManager.createShellPty(cwd))

  // Config
  registerMethod('config:load', () => configManager.loadConfig())
  registerMethod('config:save', (config) => {
    clearAgentDetectionCache()
    configManager.saveConfig(config)
    configManager.notifyChanged()
  })

  // Sessions
  registerMethod('sessions:getPrevious', () => sessionManager.getPreviousSessions())
  registerMethod('sessions:clear', () => sessionManager.clear())
  registerMethod('sessions:getRecent', (projectPath) => getRecentSessions(projectPath))

  // Git
  registerMethod('git:listBranches', (projectPath) => ({
    local: gitUtils.listBranches(projectPath),
    current: gitUtils.getGitBranch(projectPath)
  }))
  registerMethod('git:listRemoteBranches', (projectPath) =>
    gitUtils.listRemoteBranches(projectPath)
  )
  registerMethod('git:createWorktree', ({ projectPath, branch }) =>
    gitUtils.createWorktree(projectPath, branch)
  )
  registerMethod('git:removeWorktree', ({ projectPath, worktreePath, force }) =>
    gitUtils.removeWorktree(projectPath, worktreePath, force)
  )
  registerMethod('git:worktreeDirty', (worktreePath) => gitUtils.isWorktreeDirty(worktreePath))
  registerMethod('git:listWorktrees', (projectPath) => gitUtils.listWorktrees(projectPath))
  registerMethod('git:getBranch', (cwd) => gitUtils.getGitBranch(cwd))
  registerMethod('git:diffStat', (cwd) => gitUtils.getGitDiffStat(cwd))
  registerMethod('git:diffFull', (cwd) => gitUtils.getGitDiffFull(cwd))
  registerMethod('git:commit', ({ cwd, message, includeUnstaged }) =>
    gitUtils.gitCommit(cwd, message, includeUnstaged)
  )
  registerMethod('git:push', (cwd) => gitUtils.gitPush(cwd))

  // Scheduler
  registerMethod('scheduler:getLog', (workflowId) => scheduleLogManager.getEntries(workflowId))
  registerMethod('scheduler:getNextRun', (workflowId) => {
    const config = configManager.loadConfig()
    return scheduler.getNextRun(workflowId, config.workflows ?? [])
  })

  // Task images
  registerMethod('task:imageSave', ({ taskId, sourcePath }) => saveTaskImage(taskId, sourcePath))
  registerMethod('task:imageDelete', ({ taskId, filename }) => deleteTaskImage(taskId, filename))
  registerMethod('task:imageGetPath', ({ taskId, filename }) => getTaskImagePath(taskId, filename))
  registerMethod('task:imageCleanup', (taskId) => cleanupTaskImages(taskId))
  registerMethod('task:imageUpload', ({ taskId, base64, filename }) =>
    saveTaskImageFromBase64(taskId, base64, filename)
  )

  // Session archive
  registerMethod('session:archive', (session) => archiveSession(session))
  registerMethod('session:unarchive', (id) => unarchiveSession(id))
  registerMethod('session:listArchived', () => listArchivedSessions())

  // Headless
  registerMethod('headless:create', (payload) => {
    const session = headlessManager.createHeadless(payload)
    if (payload.taskId) {
      try {
        linkSessionToTask(session.id, payload.taskId, session)
      } catch (err) {
        log.error('[session-logs] failed to create headless session log:', err)
      }
    }
    return session
  })
  registerMethod('headless:kill', (id) => headlessManager.killHeadless(id))
  registerMethod('headless:list', () => headlessManager.getActiveSessions())

  // Scripts
  registerMethod('script:execute', (config) => executeScript(config))

  // Workflow runs
  registerMethod('workflowRun:save', (execution) => saveWorkflowRun(execution))
  registerMethod('workflowRun:list', ({ workflowId, limit }) => listWorkflowRuns(workflowId, limit))
  registerMethod('workflowRun:listByTask', ({ taskId, limit }) =>
    listWorkflowRunsByTask(taskId, limit)
  )

  // Session logs
  registerMethod('sessionLog:list', ({ taskId }) => listSessionLogs(taskId))
  registerMethod('sessionLog:update', (entry) => updateSessionLog(entry.sessionId, entry))

  // Agent/IDE detection
  registerMethod('agent:detectInstalled', () => detectInstalledAgents())
  registerMethod('ide:detect', () => detectIDEs())
  registerMethod('ide:open', ({ ideId, projectPath }) => openInIDE(ideId, projectPath))

  // Tailscale network access
  registerMethod('tailscale:status', async () => {
    clearBinaryCache() // Always re-detect in case user just installed
    await checkAndRebind() // Rebind if Tailscale state changed since startup
    return getTailscaleStatus(serverPort)
  })

  // Credential vault (storage — encryption handled by main process)
  registerMethod('credential:storeKey', (params) => {
    const id = crypto.randomUUID()
    dbSaveSSHKey({
      id,
      label: params.label,
      encryptedPrivateKey: params.encryptedPrivateKey,
      publicKey: params.publicKey,
      certificate: params.certificate,
      keyType: params.keyType,
      createdAt: new Date().toISOString()
    })
    return { id }
  })
  registerMethod('credential:listKeys', () => dbListSSHKeys())
  registerMethod('credential:deleteKey', (id) => dbDeleteSSHKey(id))
  registerMethod('credential:getEncryptedKey', (id) => dbGetSSHKey(id))

  // SSH
  registerMethod('ssh:testConnection', (host) => testSshConnection(host))

  // Fire-and-forget notifications
  registerNotification('terminal:write', ({ id, data }) => ptyManager.writeToPty(id, data))
  registerNotification('terminal:resize', ({ id, cols, rows }) =>
    ptyManager.resizePty(id, cols, rows)
  )

  // Permission resolution
  registerMethod('permission:resolve', ({ requestId, allow, updatedPermissions, updatedInput }) => {
    hookServer.resolvePermission(requestId, allow, { updatedPermissions, updatedInput })
  })

  // Resolve top pending permission (for global shortcuts)
  registerMethod('permission:resolve-top', ({ allow }) => {
    const pending = hookServer.getPendingPermissions()
    if (pending.length > 0) {
      hookServer.resolvePermission(pending[0].requestId, allow)
    }
  })

  // Widget status update request
  registerMethod('widget:requestUpdate', () => {
    broadcastWidgetUpdate()
  })

  // Workflow execution complete
  registerMethod(
    'workflow:executionComplete',
    (data: {
      workflowId: string
      workflowName: string
      completedAt: string
      status: 'success' | 'error'
      sessionsLaunched: number
      source?: 'scheduler' | 'manual'
    }) => {
      if (data.status !== 'success' && data.status !== 'error') return
      if (data.source === 'scheduler') {
        scheduleLogManager.addEntry({
          workflowId: data.workflowId,
          workflowName: data.workflowName,
          executedAt: data.completedAt,
          status: data.status,
          sessionsLaunched: data.sessionsLaunched
        })
      }
      updateWorkflowRunStatus(data.workflowId, data.completedAt, data.status)
      configManager.notifyChanged()
    }
  )

  // Wire manager events → broadcast to WS clients
  ptyManager.on('client-message', (channel: string, payload: unknown) => {
    clientRegistry.broadcast(channel, payload)
    // Capture terminal output for task-linked sessions
    if (channel === IPC.TERMINAL_DATA) {
      const p = payload as { id: string; data: string }
      if (p.data) bufferSessionOutput(p.id, p.data)
    }
    if (channel === IPC.TERMINAL_EXIT) {
      const p = payload as { id: string; exitCode: number }
      if (taskLinkedSessions.has(p.id)) {
        flushAndCleanup(p.id)
        try {
          updateSessionLog(p.id, {
            status: p.exitCode === 0 ? 'success' : 'error',
            completedAt: new Date().toISOString(),
            exitCode: p.exitCode
          })
        } catch (err) {
          log.error('[session-logs] failed to update exit status:', err)
        }
      }
    }
  })
  headlessManager.on('client-message', (channel: string, payload: unknown) => {
    clientRegistry.broadcast(channel, payload)
    // Capture headless output for task-linked sessions
    if (channel === IPC.HEADLESS_DATA) {
      const p = payload as { id: string; data: string }
      if (p.data) bufferSessionOutput(p.id, p.data)
    }
    if (channel === IPC.HEADLESS_EXIT) {
      const p = payload as { id: string; exitCode: number }
      if (taskLinkedSessions.has(p.id)) {
        flushAndCleanup(p.id)
        try {
          updateSessionLog(p.id, {
            status: p.exitCode === 0 ? 'success' : 'error',
            completedAt: new Date().toISOString(),
            exitCode: p.exitCode
          })
        } catch (err) {
          log.error('[session-logs] failed to update headless exit:', err)
        }
      }
    }
  })
  scheduler.on('client-message', (channel: string, payload: unknown) => {
    clientRegistry.broadcast(channel, payload)
  })

  // ─── Persistent session auto-save ──────────────────────────────
  // Combined with explicit saves on key lifecycle events (session-created,
  // session-exit, SessionStart hook), this reduces reliance on the shutdown
  // path (which has a race with bridge.close and doesn't cover
  // force-quit / crash).
  sessionManager.startAutoSave(() => ptyManager.getActiveSessions())

  // ─── Hook server integration ──────────────────────────────────

  // Handle new terminal sessions: broadcast to UI + Copilot hook setup
  ptyManager.on('session-created', (session, payload) => {
    clientRegistry.broadcast(IPC.SESSION_CREATED, session)

    if (payload.taskId) {
      try {
        linkSessionToTask(session.id, payload.taskId, session)
      } catch (err) {
        log.error('[session-logs] failed to create session log:', err)
      }
    }

    if (payload.agentType === 'copilot') {
      const port = hookServer.getPort()
      if (port <= 0) return
      const cwd = session.worktreePath || session.projectPath
      const installation = installCopilotHooks(cwd, port)
      copilotInstallations.set(session.id, installation)
      hookStatusMapper.forceLink(installation.sessionId, session.id)
      session.hookSessionId = installation.sessionId
      session.statusSource = 'hooks'
    }

    sessionManager.scheduleSave()
  })

  // Clean up Copilot hooks on session exit
  ptyManager.on('session-exit', (session) => {
    const inst = copilotInstallations.get(session.id)
    if (inst) {
      uninstallCopilotHooks(inst)
      copilotInstallations.delete(session.id)
    }

    sessionManager.scheduleSave()
  })

  // Start hook server
  hookServer
    .start()
    .then((port) => {
      try {
        installHooks(port, hookServer.getAuthToken())
      } catch (err) {
        log.error('[hooks] failed to install hooks:', err)
      }

      hookServer.on('permission-cancelled', (requestId: string) => {
        clientRegistry.broadcast(IPC.WIDGET_PERMISSION_CANCELLED, requestId)
      })

      hookServer.on('hook-event', (event) => {
        log.info(`[hooks] ${event.hook_event_name}: session=${event.session_id} cwd=${event.cwd}`)
        const result = hookStatusMapper.mapEventToStatus(event)
        if (result) {
          ptyManager.updateSessionStatus(result.terminalId, result.status)
          broadcastWidgetUpdate()

          // Persist after hookSessionId is set (SessionStart links the session)
          if (event.hook_event_name === 'SessionStart') {
            sessionManager.scheduleSave()
            try {
              const config = configManager.loadConfig()
              const task = config.tasks?.find(
                (t) =>
                  t.assignedSessionId === result.terminalId &&
                  t.status === 'in_progress' &&
                  !t.agentSessionId
              )
              if (task) {
                task.agentSessionId = event.session_id
                task.updatedAt = new Date().toISOString()
                configManager.saveConfig(config)
                log.info(
                  `[hooks] stored agentSessionId ${event.session_id} on task "${task.title}"`
                )
              }
            } catch (err) {
              log.error('[hooks] failed to persist agentSessionId:', err)
            }
          }
        }

        const dismissEvents = ['PostToolUse', 'PostToolUseFailure', 'Stop', 'UserPromptSubmit']
        if (dismissEvents.includes(event.hook_event_name)) {
          hookServer.cancelSessionPermissions(event.session_id)
        }
      })

      hookServer.on('permission-request', ({ requestId, event }) => {
        const terminalId =
          hookStatusMapper.getLinkedTerminal(event.session_id) ??
          hookStatusMapper.tryLink(event.session_id, event.cwd)

        log.info(
          `[hooks] permission-request: session=${event.session_id} tool=${event.tool_name} → terminal=${terminalId ?? 'none (passthrough)'}`
        )

        if (!terminalId) {
          hookServer.passthroughPermission(requestId)
          return
        }

        const session = ptyManager.getActiveSessions().find((s) => s.id === terminalId)

        const permReq: PermissionRequestInfo = {
          requestId,
          sessionId: event.session_id,
          terminalId,
          toolName: event.tool_name || 'unknown',
          toolInput: event.tool_input || {},
          description:
            typeof event.tool_input?.file_path === 'string'
              ? (event.tool_input.file_path as string)
              : typeof event.tool_input?.command === 'string'
                ? (event.tool_input.command as string)
                : typeof event.tool_input?.description === 'string'
                  ? (event.tool_input.description as string)
                  : undefined,
          agentType: session?.agentType,
          projectName: session?.projectName,
          permissionSuggestions: event.permission_suggestions,
          questions:
            event.tool_name === 'AskUserQuestion'
              ? (event.tool_input?.questions as PermissionRequestInfo['questions'] | undefined)
              : undefined
        }

        clientRegistry.broadcast(IPC.WIDGET_PERMISSION_REQUEST, permReq)
        ptyManager.updateSessionStatus(terminalId, 'waiting')
        broadcastWidgetUpdate()
      })
    })
    .catch((err) => {
      log.error('Failed to start hook server:', err)
    })
}

let widgetUpdateTimer: ReturnType<typeof setTimeout> | null = null

function broadcastWidgetUpdate(): void {
  if (widgetUpdateTimer) return
  widgetUpdateTimer = setTimeout(() => {
    widgetUpdateTimer = null
    const sessions = ptyManager.getActiveSessions()
    const agents: WidgetAgentInfo[] = sessions.map((s) => ({
      id: s.id,
      agentType: s.agentType,
      displayName: s.displayName,
      projectName: s.projectName,
      status: s.status
    }))
    clientRegistry.broadcast(IPC.WIDGET_STATUS_UPDATE, agents)
  }, 500)
}
