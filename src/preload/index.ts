import { contextBridge, ipcRenderer } from 'electron'
import { CreateTerminalPayload, ResizePayload, AppConfig, RecentSession, IPC, GitDiffStat, GitDiffResult, GitCommitPayload, GitCommitResult } from '../shared/types'

const api = {
  createTerminal: (payload: CreateTerminalPayload) =>
    ipcRenderer.invoke(IPC.TERMINAL_CREATE, payload),

  writeTerminal: (id: string, data: string) =>
    ipcRenderer.send(IPC.TERMINAL_WRITE, { id, data }),

  resizeTerminal: (payload: ResizePayload) =>
    ipcRenderer.send(IPC.TERMINAL_RESIZE, payload),

  killTerminal: (id: string) =>
    ipcRenderer.invoke(IPC.TERMINAL_KILL, id),

  onTerminalData: (callback: (event: { id: string; data: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: { id: string; data: string }): void => callback(event)
    ipcRenderer.on(IPC.TERMINAL_DATA, listener)
    return () => { ipcRenderer.removeListener(IPC.TERMINAL_DATA, listener) }
  },

  onTerminalExit: (callback: (event: { id: string; exitCode: number }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: { id: string; exitCode: number }): void => callback(event)
    ipcRenderer.on(IPC.TERMINAL_EXIT, listener)
    return () => { ipcRenderer.removeListener(IPC.TERMINAL_EXIT, listener) }
  },

  loadConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke(IPC.CONFIG_LOAD),

  saveConfig: (config: AppConfig) =>
    ipcRenderer.invoke(IPC.CONFIG_SAVE, config),

  onConfigChanged: (callback: (config: AppConfig) => void) => {
    const listener = (_: Electron.IpcRendererEvent, config: AppConfig): void => callback(config)
    ipcRenderer.on(IPC.CONFIG_CHANGED, listener)
    return () => { ipcRenderer.removeListener(IPC.CONFIG_CHANGED, listener) }
  },

  onMenuNewAgent: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('menu:new-agent', listener)
    return () => { ipcRenderer.removeListener('menu:new-agent', listener) }
  },

  getPreviousSessions: () =>
    ipcRenderer.invoke(IPC.SESSIONS_GET_PREVIOUS),

  clearPreviousSessions: () =>
    ipcRenderer.invoke(IPC.SESSIONS_CLEAR),

  getRecentSessions: (projectPath?: string): Promise<RecentSession[]> =>
    ipcRenderer.invoke(IPC.SESSIONS_GET_RECENT, projectPath),

  openDirectoryDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_DIRECTORY),

  openFileDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE),

  detectIDEs: (): Promise<{ id: string; name: string; command: string }[]> =>
    ipcRenderer.invoke(IPC.IDE_DETECT),

  openInIDE: (ideId: string, projectPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.IDE_OPEN, { ideId, projectPath }),

  listBranches: (projectPath: string): Promise<{ local: string[]; current: string | null }> =>
    ipcRenderer.invoke(IPC.GIT_LIST_BRANCHES, projectPath),

  listRemoteBranches: (projectPath: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.GIT_LIST_REMOTE_BRANCHES, projectPath),

  createWorktree: (projectPath: string, branch: string): Promise<{ worktreePath: string; branch: string }> =>
    ipcRenderer.invoke(IPC.GIT_CREATE_WORKTREE, { projectPath, branch }),

  removeWorktree: (projectPath: string, worktreePath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.GIT_REMOVE_WORKTREE, { projectPath, worktreePath }),

  listWorktrees: (projectPath: string): Promise<{ path: string; branch: string; isMain: boolean }[]> =>
    ipcRenderer.invoke(IPC.GIT_LIST_WORKTREES, projectPath),

  getGitDiffStat: (cwd: string): Promise<GitDiffStat | null> =>
    ipcRenderer.invoke(IPC.GIT_DIFF_STAT, cwd),

  getGitDiffFull: (cwd: string): Promise<GitDiffResult | null> =>
    ipcRenderer.invoke(IPC.GIT_DIFF_FULL, cwd),

  gitCommit: (payload: GitCommitPayload): Promise<GitCommitResult> =>
    ipcRenderer.invoke(IPC.GIT_COMMIT, payload),

  gitPush: (cwd: string): Promise<GitCommitResult> =>
    ipcRenderer.invoke(IPC.GIT_PUSH, cwd),

  onWorktreeCleanup: (callback: (session: { id: string; projectPath: string; worktreePath: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, session: { id: string; projectPath: string; worktreePath: string }): void => callback(session)
    ipcRenderer.on(IPC.WORKTREE_CONFIRM_CLEANUP, listener)
    return () => { ipcRenderer.removeListener(IPC.WORKTREE_CONFIRM_CLEANUP, listener) }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type VibeGridAPI = typeof api
