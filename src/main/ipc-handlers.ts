import { ipcMain, dialog, BrowserWindow } from 'electron'
import { ptyManager } from './pty-manager'
import { configManager } from './config-manager'
import { sessionManager } from './session-persistence'
import { scheduleLogManager } from './schedule-log'
import { scheduler } from './scheduler'
import { getRecentSessions } from './agent-history'
import { detectIDEs, openInIDE } from './ide-detector'
import { CreateTerminalPayload, IPC, ResizePayload, AppConfig } from '../shared/types'
import { listBranches, listRemoteBranches, getGitBranch, createWorktree, removeWorktree, listWorktrees, getGitDiffStat, getGitDiffFull, gitCommit, gitPush } from './git-utils'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.TERMINAL_CREATE, (_, payload: CreateTerminalPayload) =>
    ptyManager.createPty(payload)
  )

  ipcMain.handle(IPC.TERMINAL_KILL, (_, id: string) =>
    ptyManager.killPty(id)
  )

  ipcMain.handle(IPC.CONFIG_LOAD, () =>
    configManager.loadConfig()
  )

  ipcMain.handle(IPC.CONFIG_SAVE, (_, config: AppConfig) =>
    configManager.saveConfig(config)
  )

  ipcMain.handle(IPC.SESSIONS_GET_PREVIOUS, () =>
    sessionManager.getPreviousSessions()
  )

  ipcMain.handle(IPC.SESSIONS_CLEAR, () =>
    sessionManager.clear()
  )

  ipcMain.handle(IPC.SESSIONS_GET_RECENT, (_, projectPath?: string) =>
    getRecentSessions(projectPath)
  )

  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select Project Folder'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      title: 'Select SSH Key'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.IDE_DETECT, () => detectIDEs())

  ipcMain.handle(IPC.IDE_OPEN, (_, { ideId, projectPath }: { ideId: string; projectPath: string }) =>
    openInIDE(ideId, projectPath)
  )

  // Git operations
  ipcMain.handle(IPC.GIT_LIST_BRANCHES, (_, projectPath: string) => ({
    local: listBranches(projectPath),
    current: getGitBranch(projectPath)
  }))

  ipcMain.handle(IPC.GIT_LIST_REMOTE_BRANCHES, (_, projectPath: string) =>
    listRemoteBranches(projectPath)
  )

  ipcMain.handle(IPC.GIT_CREATE_WORKTREE, (_, { projectPath, branch }: { projectPath: string; branch: string }) =>
    createWorktree(projectPath, branch)
  )

  ipcMain.handle(IPC.GIT_REMOVE_WORKTREE, (_, { projectPath, worktreePath }: { projectPath: string; worktreePath: string }) =>
    removeWorktree(projectPath, worktreePath)
  )

  ipcMain.handle(IPC.GIT_LIST_WORKTREES, (_, projectPath: string) =>
    listWorktrees(projectPath)
  )

  ipcMain.handle(IPC.GIT_DIFF_STAT, (_, cwd: string) =>
    getGitDiffStat(cwd)
  )

  ipcMain.handle(IPC.GIT_DIFF_FULL, (_, cwd: string) =>
    getGitDiffFull(cwd)
  )

  ipcMain.handle(IPC.GIT_COMMIT, (_, { cwd, message, includeUnstaged }: { cwd: string; message: string; includeUnstaged: boolean }) =>
    gitCommit(cwd, message, includeUnstaged)
  )

  ipcMain.handle(IPC.GIT_PUSH, (_, cwd: string) =>
    gitPush(cwd)
  )

  // Scheduler
  ipcMain.handle(IPC.SCHEDULER_GET_LOG, (_, workflowId?: string) =>
    scheduleLogManager.getEntries(workflowId)
  )

  ipcMain.handle(IPC.SCHEDULER_GET_NEXT_RUN, (_, workflowId: string) => {
    const config = configManager.loadConfig()
    return scheduler.getNextRun(workflowId, config.shortcuts ?? [])
  })

  // High-frequency fire-and-forget channels
  ipcMain.on(IPC.TERMINAL_WRITE, (_, { id, data }: { id: string; data: string }) =>
    ptyManager.writeToPty(id, data)
  )

  ipcMain.on(IPC.TERMINAL_RESIZE, (_, payload: ResizePayload) =>
    ptyManager.resizePty(payload.id, payload.cols, payload.rows)
  )
}
