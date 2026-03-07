export type AgentType = 'claude' | 'copilot' | 'codex' | 'opencode' | 'gemini'

export type AgentStatus = 'running' | 'waiting' | 'idle' | 'error'

export interface AgentCommandConfig {
  command: string
  args: string[]
  fallbackCommand?: string
  fallbackArgs?: string[]
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
  hookSessionId?: string
  statusSource?: 'hooks' | 'pattern'
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
  taskId?: string          // Reference a specific task (mutually exclusive with prompt)
  taskFromQueue?: boolean  // Auto-pick next todo task from project queue
}

// Task queue types
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type TaskViewMode = 'list' | 'kanban'

export interface TaskConfig {
  id: string
  projectName: string
  title: string
  description: string
  status: TaskStatus
  order: number
  assignedSessionId?: string
  assignedAgent?: AgentType
  branch?: string
  useWorktree?: boolean
  createdAt: string
  updatedAt: string
  completedAt?: string
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
    reopenSessions?: boolean
    widgetEnabled?: boolean
    taskViewMode?: TaskViewMode
  }
  projects: ProjectConfig[]
  agentCommands?: Partial<Record<AgentType, AgentCommandConfig>>
  shortcuts?: ShortcutConfig[]
  remoteHosts?: RemoteHost[]
  tasks?: TaskConfig[]
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
  SCHEDULER_GET_NEXT_RUN: 'scheduler:getNextRun',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WIDGET_STATUS_UPDATE: 'widget:status-update',
  WIDGET_FOCUS_TERMINAL: 'widget:focus-terminal',
  WIDGET_HIDE: 'widget:hide',
  WIDGET_TOGGLE: 'widget:toggle',
  WIDGET_RENDERER_STATUS: 'widget:renderer-status',
  WIDGET_SET_ENABLED: 'widget:set-enabled',
  WIDGET_PERMISSION_REQUEST: 'widget:permission-request',
  WIDGET_PERMISSION_RESPONSE: 'widget:permission-response',
  WIDGET_PERMISSION_CANCELLED: 'widget:permission-cancelled',
  SHELL_CREATE: 'shell:create',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_INSTALL: 'update:install'
} as const

export interface PermissionSuggestion {
  type: 'addRules' | 'setMode' | string
  destination?: string        // "session" | "localSettings"
  behavior?: string           // "allow"
  rules?: Array<{ toolName?: string; ruleContent?: string }>
  mode?: string               // "acceptEdits" | "plan"
  [key: string]: unknown
}

export interface AskUserQuestion {
  question: string
  header?: string
  multiSelect?: boolean
  options?: Array<{ label: string; description?: string }>
}

export interface HookEvent {
  session_id: string
  hook_event_name: string
  cwd: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_use_id?: string
  permission_mode?: string
  transcript_path?: string
  message?: string
  title?: string
  permission_suggestions?: PermissionSuggestion[]
}

export interface PermissionRequestInfo {
  requestId: string
  sessionId: string
  terminalId?: string
  toolName: string
  toolInput: Record<string, unknown>
  description?: string
  agentType?: AgentType
  projectName?: string
  permissionSuggestions?: PermissionSuggestion[]
  /** Populated when toolName === "AskUserQuestion" */
  questions?: AskUserQuestion[]
}

export interface WidgetAgentInfo {
  id: string
  agentType: AgentType
  displayName?: string
  projectName: string
  status: AgentStatus
}

export interface ScheduleLogEntry {
  workflowId: string
  workflowName: string
  executedAt: string
  status: 'success' | 'error' | 'missed'
  sessionsLaunched: number
  error?: string
}
