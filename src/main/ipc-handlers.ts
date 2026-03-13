import { app, dialog, BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { safeHandle } from './ipc-safe-handle'
import { ptyManager } from './pty-manager'
import { headlessManager } from './headless-manager'
import { configManager } from './config-manager'
import { sessionManager } from './session-persistence'
import { scheduleLogManager } from './schedule-log'
import { scheduler } from './scheduler'
import { getRecentSessions } from './agent-history'
import { detectIDEs, openInIDE } from './ide-detector'
import { detectInstalledAgents, clearAgentDetectionCache } from './agent-detector'
import {
  CreateTerminalPayload,
  IPC,
  ResizePayload,
  AppConfig,
  ArchivedSession,
  TerminalSession
} from '../shared/types'
import {
  listBranches,
  listRemoteBranches,
  getGitBranch,
  createWorktree,
  removeWorktree,
  isWorktreeDirty,
  listWorktrees,
  getGitDiffStat,
  getGitDiffFull,
  gitCommit,
  gitPush
} from './git-utils'
import { saveTaskImage, deleteTaskImage, getTaskImagePath, cleanupTaskImages } from './task-images'
import {
  archiveSession,
  unarchiveSession,
  listArchivedSessions,
  saveWorkflowRun,
  listWorkflowRuns,
  listWorkflowRunsByTask,
  updateWorkflowRunStatus
} from './database'
import { executeScript } from './script-runner'
import { WorkflowExecution, ScriptConfig } from '../shared/types'

export interface IpcHandlerOptions {
  onSessionCreated?: (session: TerminalSession, payload: CreateTerminalPayload) => void
}

export function registerIpcHandlers(options?: IpcHandlerOptions): void {
  safeHandle(IPC.TERMINAL_CREATE, (_, payload: CreateTerminalPayload) => {
    const session = ptyManager.createPty(payload)
    options?.onSessionCreated?.(session, payload)
    return session
  })

  safeHandle(IPC.TERMINAL_KILL, (_, id: string) => ptyManager.killPty(id))

  safeHandle(IPC.SHELL_CREATE, (_, cwd?: string) => ptyManager.createShellPty(cwd))

  safeHandle(IPC.CONFIG_LOAD, () => configManager.loadConfig())

  safeHandle(IPC.CONFIG_SAVE, (_, config: AppConfig) => {
    clearAgentDetectionCache()
    return configManager.saveConfig(config)
  })

  safeHandle(IPC.SESSIONS_GET_PREVIOUS, () => sessionManager.getPreviousSessions())

  safeHandle(IPC.SESSIONS_CLEAR, () => sessionManager.clear())

  safeHandle(IPC.SESSIONS_GET_RECENT, (_, projectPath?: string) => getRecentSessions(projectPath))

  safeHandle(IPC.DIALOG_OPEN_DIRECTORY, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  safeHandle(IPC.DIALOG_OPEN_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'Select SSH Key'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  safeHandle(IPC.IDE_DETECT, () => detectIDEs())

  safeHandle(IPC.AGENT_DETECT_INSTALLED, () => detectInstalledAgents())

  safeHandle(IPC.IDE_OPEN, (_, { ideId, projectPath }: { ideId: string; projectPath: string }) =>
    openInIDE(ideId, projectPath)
  )

  // Git operations
  safeHandle(IPC.GIT_LIST_BRANCHES, (_, projectPath: string) => ({
    local: listBranches(projectPath),
    current: getGitBranch(projectPath)
  }))

  safeHandle(IPC.GIT_LIST_REMOTE_BRANCHES, (_, projectPath: string) =>
    listRemoteBranches(projectPath)
  )

  safeHandle(
    IPC.GIT_CREATE_WORKTREE,
    (_, { projectPath, branch }: { projectPath: string; branch: string }) =>
      createWorktree(projectPath, branch)
  )

  safeHandle(
    IPC.GIT_REMOVE_WORKTREE,
    (
      _,
      {
        projectPath,
        worktreePath,
        force
      }: { projectPath: string; worktreePath: string; force?: boolean }
    ) => removeWorktree(projectPath, worktreePath, force)
  )

  safeHandle(IPC.GIT_WORKTREE_DIRTY, (_, worktreePath: string) => isWorktreeDirty(worktreePath))

  safeHandle(IPC.GIT_LIST_WORKTREES, (_, projectPath: string) => listWorktrees(projectPath))

  safeHandle(IPC.GIT_DIFF_STAT, (_, cwd: string) => getGitDiffStat(cwd))

  safeHandle(IPC.GIT_DIFF_FULL, (_, cwd: string) => getGitDiffFull(cwd))

  safeHandle(
    IPC.GIT_COMMIT,
    (
      _,
      { cwd, message, includeUnstaged }: { cwd: string; message: string; includeUnstaged: boolean }
    ) => gitCommit(cwd, message, includeUnstaged)
  )

  safeHandle(IPC.GIT_PUSH, (_, cwd: string) => gitPush(cwd))

  // Scheduler
  safeHandle(IPC.SCHEDULER_GET_LOG, (_, workflowId?: string) =>
    scheduleLogManager.getEntries(workflowId)
  )

  safeHandle(IPC.SCHEDULER_GET_NEXT_RUN, (_, workflowId: string) => {
    const config = configManager.loadConfig()
    return scheduler.getNextRun(workflowId, config.workflows ?? [])
  })

  // Task images
  safeHandle(IPC.DIALOG_OPEN_IMAGE, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
    })
    return result.canceled ? null : result.filePaths
  })

  safeHandle(
    IPC.TASK_IMAGE_SAVE,
    (_, { taskId, sourcePath }: { taskId: string; sourcePath: string }) =>
      saveTaskImage(taskId, sourcePath)
  )

  safeHandle(
    IPC.TASK_IMAGE_DELETE,
    (_, { taskId, filename }: { taskId: string; filename: string }) =>
      deleteTaskImage(taskId, filename)
  )

  safeHandle(
    IPC.TASK_IMAGE_GET_PATH,
    (_, { taskId, filename }: { taskId: string; filename: string }) =>
      getTaskImagePath(taskId, filename)
  )

  safeHandle(IPC.TASK_IMAGE_CLEANUP, (_, taskId: string) => cleanupTaskImages(taskId))

  // Session archive
  safeHandle(IPC.SESSION_ARCHIVE, (_, session: ArchivedSession) =>
    archiveSession({
      id: session.id,
      agentType: session.agentType,
      projectName: session.projectName,
      projectPath: session.projectPath,
      displayName: session.displayName,
      branch: session.branch,
      agentSessionId: session.agentSessionId,
      archivedAt: session.archivedAt
    })
  )

  safeHandle(IPC.SESSION_UNARCHIVE, (_, id: string) => unarchiveSession(id))

  safeHandle(IPC.SESSION_LIST_ARCHIVED, () => listArchivedSessions())

  // Headless sessions
  safeHandle(IPC.HEADLESS_CREATE, (_, payload: CreateTerminalPayload) =>
    headlessManager.createHeadless(payload)
  )

  safeHandle(IPC.HEADLESS_KILL, (_, id: string) => headlessManager.killHeadless(id))

  safeHandle(IPC.SCRIPT_EXECUTE, (_, config: ScriptConfig) => executeScript(config))

  // Workflow runs
  safeHandle(IPC.WORKFLOW_RUN_SAVE, (_, execution: WorkflowExecution) => saveWorkflowRun(execution))

  safeHandle(IPC.WORKFLOW_RUN_LIST, (_, workflowId: string, limit?: number) =>
    listWorkflowRuns(workflowId, limit)
  )

  safeHandle(IPC.WORKFLOW_RUN_LIST_BY_TASK, (_, taskId: string, limit?: number) =>
    listWorkflowRunsByTask(taskId, limit)
  )

  // Workflow execution complete — report status from renderer after actual execution
  safeHandle(
    IPC.WORKFLOW_EXECUTION_COMPLETE,
    (
      _,
      data: {
        workflowId: string
        workflowName: string
        completedAt: string
        status: string
        sessionsLaunched: number
        source?: 'scheduler' | 'manual'
      }
    ) => {
      if (data.source === 'scheduler') {
        scheduleLogManager.addEntry({
          workflowId: data.workflowId,
          workflowName: data.workflowName,
          executedAt: data.completedAt,
          status: data.status as 'success' | 'error',
          sessionsLaunched: data.sessionsLaunched
        })
      }
      updateWorkflowRunStatus(data.workflowId, data.completedAt, data.status)
      configManager.notifyChanged()
    }
  )

  // App version (sync)
  ipcMain.on('get-app-version', (event) => {
    event.returnValue = app.getVersion()
  })

  // High-frequency fire-and-forget channels
  ipcMain.on(IPC.TERMINAL_WRITE, (_, { id, data }: { id: string; data: string }) =>
    ptyManager.writeToPty(id, data)
  )

  ipcMain.on(IPC.TERMINAL_RESIZE, (_, payload: ResizePayload) =>
    ptyManager.resizePty(payload.id, payload.cols, payload.rows)
  )
}
