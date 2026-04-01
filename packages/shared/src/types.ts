export type AgentType = 'claude' | 'copilot' | 'codex' | 'opencode' | 'gemini'

export type AgentStatus = 'running' | 'waiting' | 'idle' | 'error'

export function supportsExactSessionResume(agentType: AgentType): boolean {
  return agentType !== 'gemini'
}

export function getRecentSessionActivityLabel(agentType: AgentType): string {
  switch (agentType) {
    case 'claude':
      return 'entry'
    case 'codex':
      return 'entry'
    case 'copilot':
      return 'turn'
    case 'gemini':
      return 'prompt'
    case 'opencode':
      return 'message'
  }
}

export interface AgentCommandConfig {
  command: string
  args: string[]
  headlessArgs?: string[]
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
  worktreeName?: string
  isWorktree?: boolean
  remoteHostId?: string
  remoteHostLabel?: string
  hookSessionId?: string
  statusSource?: 'hooks' | 'pattern'
  pinned?: boolean
}

export interface ArchivedSession {
  id: string
  agentType: AgentType
  projectName: string
  projectPath: string
  displayName?: string
  branch?: string
  agentSessionId?: string
  archivedAt: number
}

export type AuthMethod = 'key-file' | 'key-stored' | 'password' | 'agent'

export interface SSHKey {
  id: string
  label: string
  /** Base64-encoded safeStorage-encrypted private key */
  encryptedPrivateKey: string
  publicKey?: string
  certificate?: string
  keyType?: string
  createdAt: string
}

export interface SSHKeyMeta {
  id: string
  label: string
  keyType?: string
  publicKey?: string
  createdAt: string
}

export interface RemoteHost {
  id: string
  label: string
  hostname: string
  user: string
  port: number
  authMethod?: AuthMethod
  sshKeyPath?: string
  credentialId?: string
  encryptedPassword?: string
  sshOptions?: string
}

export interface WorkspaceConfig {
  id: string // 'personal' for default, UUID for user-created
  name: string
  icon?: string
  iconColor?: string
  order: number
}

export const DEFAULT_WORKSPACE: WorkspaceConfig = {
  id: 'personal',
  name: 'Personal',
  icon: 'User',
  iconColor: '#6b7280',
  order: 0
}

export interface ProjectConfig {
  name: string
  path: string
  preferredAgents: AgentType[]
  icon?: string
  iconColor?: string
  hostIds?: string[] // 'local' | remote host UUIDs; absent = ['local']
  workspaceId?: string // defaults to 'personal' if absent
}

export function getProjectHostIds(project: ProjectConfig): string[] {
  return project.hostIds?.length ? project.hostIds : ['local']
}

// Task queue types
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'

export type TaskViewMode = 'list' | 'kanban'

export type MainViewMode = 'sessions' | 'tasks'

export interface TaskConfig {
  id: string
  projectName: string
  title: string
  description: string
  status: TaskStatus
  order: number
  assignedSessionId?: string
  assignedAgent?: AgentType
  agentSessionId?: string // Real agent session ID (e.g. Claude session_id from hooks) for resume
  branch?: string
  useWorktree?: boolean
  worktreePath?: string
  images?: string[] // filenames relative to task-images/{taskId}/
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// Session event types (lifecycle activity log)
export type SessionEventType =
  | 'created'
  | 'exited'
  | 'task_linked'
  | 'renamed'
  | 'archived'
  | 'unarchived'

export interface SessionEvent {
  id?: number
  sessionId: string
  eventType: SessionEventType
  timestamp: string
  metadata?: Record<string, unknown>
}

// Session activity log types
export type SessionLogStatus = 'running' | 'success' | 'error'

export interface SessionLog {
  id?: number
  taskId: string
  sessionId: string
  agentType?: AgentType
  branch?: string
  status: SessionLogStatus
  startedAt: string
  completedAt?: string
  exitCode?: number
  logs?: string
  projectName?: string
}

// --- Workflow engine types (Logic Apps-style) ---

// Execution context passed from triggers to the execution engine
export interface WorkflowExecutionContext {
  task?: TaskConfig
  trigger?: {
    type: TriggerConfig['triggerType']
    fromStatus?: TaskStatus
    toStatus?: TaskStatus
  }
}

export type WorkflowNodeType = 'trigger' | 'launchAgent' | 'script' | 'condition'

export interface WorkflowNodePosition {
  x: number
  y: number
}

// Trigger configs (discriminated union)
export interface ManualTriggerConfig {
  triggerType: 'manual'
}
export interface OnceTriggerConfig {
  triggerType: 'once'
  runAt: string
}
export interface RecurringTriggerConfig {
  triggerType: 'recurring'
  cron: string
  timezone?: string
}
export interface TaskCreatedTriggerConfig {
  triggerType: 'taskCreated'
  projectFilter?: string
}
export interface TaskStatusChangedTriggerConfig {
  triggerType: 'taskStatusChanged'
  projectFilter?: string
  fromStatus?: TaskStatus
  toStatus?: TaskStatus
}
export type TriggerConfig =
  | ManualTriggerConfig
  | OnceTriggerConfig
  | RecurringTriggerConfig
  | TaskCreatedTriggerConfig
  | TaskStatusChangedTriggerConfig

// Launch Agent action config
export interface LaunchAgentConfig {
  agentType: AgentType
  projectName: string
  projectPath: string
  args?: string[]
  displayName?: string
  branch?: string
  useWorktree?: boolean
  worktreeMode?: 'none' | 'new' | 'fromStep' | 'existing'
  worktreeFromStepSlug?: string
  existingWorktreePath?: string
  remoteHostId?: string
  prompt?: string
  promptDelayMs?: number
  taskId?: string
  taskFromQueue?: boolean
  headless?: boolean
}

export interface ScriptConfig {
  scriptType: 'bash' | 'powershell' | 'python' | 'node'
  scriptContent: string
  cwd?: string
  projectName?: string // for resolving cwd
  projectPath?: string
  args?: string[]
}

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'

export interface ConditionConfig {
  variable: string
  operator: ConditionOperator
  value: string
}

export type WorkflowNodeConfig = TriggerConfig | LaunchAgentConfig | ScriptConfig | ConditionConfig

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string
  slug?: string
  config: WorkflowNodeConfig
  position: WorkflowNodePosition
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  conditionBranch?: 'true' | 'false'
}

// Execution tracking (runtime only)
export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface NodeExecutionState {
  nodeId: string
  status: NodeExecutionStatus
  startedAt?: string
  completedAt?: string
  sessionId?: string
  error?: string
  logs?: string
  output?: string
  taskId?: string
  agentSessionId?: string
  worktreePath?: string
  worktreeName?: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  icon: string
  iconColor: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  enabled: boolean
  lastRunAt?: string
  lastRunStatus?: 'success' | 'error'
  staggerDelayMs?: number
  workspaceId?: string // defaults to 'personal' if absent
  autoCleanupWorktrees?: boolean
}

export interface WorkflowExecution {
  workflowId: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'success' | 'error'
  nodeStates: NodeExecutionState[]
  triggerTaskId?: string
}

// ─── Tailscale Network Access ────────────────────────────────────

export interface TailscalePeer {
  ip: string
  hostname: string
  dnsName: string
  os: string
  online: boolean
}

export interface TailscaleStatus {
  installed: boolean
  running: boolean
  backendState: string
  selfIP: string
  selfDNSName: string
  selfOS?: string
  peers: TailscalePeer[]
  appUrl?: string
}

export interface NotificationConfig {
  enabled: boolean
  onWaiting: boolean
  onError: boolean
  onBell: boolean
  soundEnabled?: boolean
  soundVolume?: number // 0.0 – 1.0, default 0.5
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
    hasSeenOnboarding?: boolean | number
    reopenSessions?: boolean
    widgetEnabled?: boolean
    taskViewMode?: TaskViewMode
    layoutMode?: 'grid' | 'tabs'
    mainViewMode?: MainViewMode
    activeWorkspace?: string
    updateChannel?: 'stable' | 'beta'
    webAccessEnabled?: boolean
    mobileAccessEnabled?: boolean
    networkAccessEnabled?: boolean
    showHeadlessAgents?: boolean
    headlessRetentionMinutes?: number
  }
  projects: ProjectConfig[]
  agentCommands?: Partial<Record<AgentType, AgentCommandConfig>>
  workflows?: WorkflowDefinition[]
  remoteHosts?: RemoteHost[]
  tasks?: TaskConfig[]
  workspaces?: WorkspaceConfig[]
}

export interface RecentSession {
  sessionId: string
  agentType: AgentType
  display: string
  projectPath: string
  timestamp: number
  activityCount: number
  activityLabel: string
  canResumeExact: boolean
}

export interface CreateTerminalPayload {
  agentType: AgentType
  projectName: string
  projectPath: string
  resumeSessionId?: string
  /** Pre-generated agent session ID (used with --session-id for Claude) */
  sessionId?: string
  displayName?: string
  branch?: string
  useWorktree?: boolean
  /** Pass an existing worktree path to reuse it (skips createWorktree) */
  existingWorktreePath?: string
  /** Friendly worktree name (e.g. "amber-aurora") */
  worktreeName?: string
  remoteHostId?: string
  initialPrompt?: string
  promptDelayMs?: number
  headless?: boolean
  /** Task ID — when set, the main process writes a .vibegrid/context.md file before agent spawn */
  taskId?: string
  /** Workflow metadata — for tagging headless sessions launched by workflows */
  workflowId?: string
  workflowName?: string
  /** Per-invocation arg overrides (replaces settings-level args when set) */
  args?: string[]
  /** Transient: decrypted private key content for stored-key auth. Never persisted. */
  _decryptedKeyContent?: string
  /** Transient: decrypted password for password auth. Never persisted. */
  _decryptedPassword?: string
}

export interface HeadlessSession {
  id: string
  pid: number
  agentType: AgentType
  projectName: string
  projectPath: string
  displayName?: string
  branch?: string
  worktreePath?: string
  worktreeName?: string
  isWorktree?: boolean
  status: 'running' | 'exited'
  exitCode?: number
  startedAt: number
  endedAt?: number
  /** Workflow that launched this session */
  workflowId?: string
  workflowName?: string
  /** Task this session is working on */
  taskId?: string
}

export interface ResizePayload {
  id: string
  cols: number
  rows: number
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
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
  SESSION_CREATED: 'session:created',
  SESSION_UPDATED: 'session:updated',
  SESSION_REORDERED: 'session:reordered',
  TERMINAL_RENAME: 'terminal:rename-session',
  TERMINAL_REORDER: 'terminal:reorder-sessions',
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
  GIT_RENAME_WORKTREE_BRANCH: 'git:renameWorktreeBranch',
  GIT_RENAME_WORKTREE: 'git:renameWorktree',
  GIT_WORKTREE_DIRTY: 'git:worktreeDirty',
  GIT_LIST_WORKTREES: 'git:listWorktrees',
  GIT_CHECKOUT_BRANCH: 'git:checkoutBranch',
  GIT_GET_WORKTREE_BRANCH: 'git:getWorktreeBranch',
  WORKTREE_CONFIRM_CLEANUP: 'worktree:confirmCleanup',
  WORKTREE_ACTIVE_SESSIONS: 'worktree:activeSessions',
  GIT_GET_BRANCH: 'git:getBranch',
  GIT_DIFF_STAT: 'git:diffStat',
  GIT_DIFF_FULL: 'git:diffFull',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  SCHEDULER_EXECUTE: 'scheduler:execute',
  SCHEDULER_MISSED: 'scheduler:missed',
  SCHEDULER_GET_LOG: 'scheduler:getLog',
  SCHEDULER_GET_NEXT_RUN: 'scheduler:getNextRun',
  WORKFLOW_EXECUTION_COMPLETE: 'workflow:executionComplete',
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
  UPDATE_INSTALL: 'update:install',
  UPDATE_SET_CHANNEL: 'update:set-channel',
  TASK_IMAGE_SAVE: 'task:imageSave',
  TASK_IMAGE_DELETE: 'task:imageDelete',
  TASK_IMAGE_GET_PATH: 'task:imageGetPath',
  TASK_IMAGE_CLEANUP: 'task:imageCleanup',
  DIALOG_OPEN_IMAGE: 'dialog:openImage',
  SESSION_ARCHIVE: 'session:archive',
  SESSION_UNARCHIVE: 'session:unarchive',
  SESSION_LIST_ARCHIVED: 'session:listArchived',
  HEADLESS_CREATE: 'headless:create',
  HEADLESS_KILL: 'headless:kill',
  HEADLESS_LIST: 'headless:list',
  HEADLESS_DATA: 'headless:data',
  HEADLESS_EXIT: 'headless:exit',
  SCRIPT_EXECUTE: 'script:execute',
  WORKFLOW_RUN_SAVE: 'workflowRun:save',
  WORKFLOW_RUN_LIST: 'workflowRun:list',
  WORKFLOW_RUN_LIST_BY_TASK: 'workflowRun:listByTask',
  SESSION_LOG_LIST: 'sessionLog:list',
  SESSION_LOG_UPDATE: 'sessionLog:update',
  SESSION_EVENT_LIST: 'sessionEvent:list',
  SESSION_EVENT_LIST_BY_SESSION: 'sessionEvent:listBySession',
  AGENT_DETECT_INSTALLED: 'agent:detectInstalled',
  TAILSCALE_STATUS: 'tailscale:status',
  CREDENTIAL_STORE_KEY: 'credential:storeKey',
  CREDENTIAL_IMPORT_KEY_FILE: 'credential:importKeyFile',
  CREDENTIAL_DELETE_KEY: 'credential:deleteKey',
  CREDENTIAL_LIST_KEYS: 'credential:listKeys',
  CREDENTIAL_GET_ENCRYPTED_KEY: 'credential:getEncryptedKey',
  CREDENTIAL_ENCRYPT: 'credential:encrypt',
  CREDENTIAL_SAFE_STORAGE_AVAILABLE: 'credential:safeStorageAvailable',
  SSH_TEST_CONNECTION: 'ssh:testConnection',
  OPEN_EXTERNAL: 'shell:openExternal',
  FILE_LIST_DIR: 'file:listDir',
  FILE_READ_CONTENT: 'file:readContent'
} as const

export interface PermissionSuggestion {
  type: 'addRules' | 'setMode' | string
  destination?: string // "session" | "localSettings"
  behavior?: string // "allow"
  rules?: Array<{ toolName?: string; ruleContent?: string }>
  mode?: string // "acceptEdits" | "plan"
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
