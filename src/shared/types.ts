export type AgentType = 'claude' | 'copilot' | 'codex' | 'opencode' | 'gemini'

export type AgentStatus = 'running' | 'waiting' | 'idle' | 'error'

export interface AgentCommandConfig {
  command: string
  args: string[]
}

export interface TerminalSession {
  id: string
  agentType: AgentType
  projectName: string
  projectPath: string
  status: AgentStatus
  createdAt: number
  pid: number
  displayName?: string
  branch?: string
  worktreePath?: string
  isWorktree?: boolean
  remoteHostId?: string
  remoteHostLabel?: string
}

export interface RemoteHost {
  id: string
  label: string
  hostname: string
  user: string
  port: number
  sshKeyPath?: string
  sshOptions?: string
}

export interface ProjectConfig {
  name: string
  path: string
  preferredAgents: AgentType[]
  icon?: string
  iconColor?: string
  hostIds?: string[] // 'local' | remote host UUIDs; absent = ['local']
}

export function getProjectHostIds(project: ProjectConfig): string[] {
  return project.hostIds?.length ? project.hostIds : ['local']
}

export interface ShortcutAction {
  agentType: AgentType
  projectName: string
  projectPath: string
  args?: string[]
  displayName?: string
  branch?: string
  useWorktree?: boolean
  remoteHostId?: string
  prompt?: string
  promptDelayMs?: number
}

// Schedule types for workflows
export interface ScheduleManual { type: 'manual' }
export interface ScheduleOnce { type: 'once'; runAt: string /* ISO 8601 */ }
export interface ScheduleRecurring { type: 'recurring'; cron: string; timezone?: string }
export type Schedule = ScheduleManual | ScheduleOnce | ScheduleRecurring

export interface WorkflowConfig {
  id: string
  name: string
  icon: string
  iconColor: string
  actions: ShortcutAction[]
  schedule: Schedule
  enabled: boolean
  lastRunAt?: string
  lastRunStatus?: 'success' | 'error'
  staggerDelayMs?: number
}

// Backwards compatibility — config YAML key remains "shortcuts"
export type ShortcutConfig = WorkflowConfig

export interface NotificationConfig {
  enabled: boolean
  onWaiting: boolean
  onError: boolean
  onBell: boolean
}

export interface AppConfig {
  version: number
  defaults: {
    shell: string
    fontSize: number
    theme: 'dark' | 'light'
    rowHeight?: number
    defaultAgent?: AgentType
    notifications?: NotificationConfig
    hasSeenOnboarding?: boolean
  }
  projects: ProjectConfig[]
  agentCommands?: Partial<Record<AgentType, AgentCommandConfig>>
  shortcuts?: ShortcutConfig[]
  remoteHosts?: RemoteHost[]
}

export interface RecentSession {
  sessionId: string
  agentType: AgentType
  display: string
  projectPath: string
  timestamp: number
  messageCount: number
}

export interface CreateTerminalPayload {
  agentType: AgentType
  projectName: string
  projectPath: string
  resumeSessionId?: string
  displayName?: string
  branch?: string
  useWorktree?: boolean
  remoteHostId?: string
  initialPrompt?: string
  promptDelayMs?: number
}

export interface ResizePayload {
  id: string
  cols: number
  rows: number
}

export interface GitDiffStat {
  filesChanged: number
  insertions: number
  deletions: number
}

export interface GitFileDiff {
  filePath: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  insertions: number
  deletions: number
  diff: string
}

export interface GitDiffResult {
  stat: GitDiffStat
  files: GitFileDiff[]
}

export interface GitCommitPayload {
  cwd: string
  message: string
  includeUnstaged: boolean
}

export interface GitCommitResult {
  success: boolean
  error?: string
}

export const IPC = {
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  CONFIG_LOAD: 'config:load',
  CONFIG_SAVE: 'config:save',
  CONFIG_CHANGED: 'config:changed',
  SESSIONS_GET_PREVIOUS: 'sessions:getPrevious',
  SESSIONS_CLEAR: 'sessions:clear',
  SESSIONS_GET_RECENT: 'sessions:getRecent',
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',
  IDE_DETECT: 'ide:detect',
  IDE_OPEN: 'ide:open',
  GIT_LIST_BRANCHES: 'git:listBranches',
  GIT_LIST_REMOTE_BRANCHES: 'git:listRemoteBranches',
  GIT_CREATE_WORKTREE: 'git:createWorktree',
  GIT_REMOVE_WORKTREE: 'git:removeWorktree',
  GIT_LIST_WORKTREES: 'git:listWorktrees',
  WORKTREE_CONFIRM_CLEANUP: 'worktree:confirmCleanup',
  GIT_DIFF_STAT: 'git:diffStat',
  GIT_DIFF_FULL: 'git:diffFull',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  SCHEDULER_EXECUTE: 'scheduler:execute',
  SCHEDULER_MISSED: 'scheduler:missed',
  SCHEDULER_GET_LOG: 'scheduler:getLog',
  SCHEDULER_GET_NEXT_RUN: 'scheduler:getNextRun'
} as const

export interface ScheduleLogEntry {
  workflowId: string
  workflowName: string
  executedAt: string
  status: 'success' | 'error' | 'missed'
  sessionsLaunched: number
  error?: string
}
