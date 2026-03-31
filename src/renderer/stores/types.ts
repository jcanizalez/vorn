import {
  AgentStatus,
  AgentType,
  AppConfig,
  ProjectConfig,
  WorkflowDefinition,
  WorkflowExecution,
  WorkspaceConfig,
  RemoteHost,
  TerminalSession,
  HeadlessSession,
  GitDiffStat,
  TaskConfig,
  TaskStatus,
  ArchivedSession
} from '../../shared/types'

export interface WorktreeInfo {
  path: string
  branch: string
  isMain: boolean
  name: string
  isDirty?: boolean
  diffStat?: { filesChanged: number; insertions: number; deletions: number }
  linkedSessionId?: string
}

export const MAIN_WORKTREE_SENTINEL = '__main__'

export type SortMode = 'manual' | 'created' | 'recent'
export type StatusFilter = AgentStatus | 'all'
export type TaskStatusFilter = 'all' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type ProjectSortMode = 'manual' | 'name' | 'recent'
export type WorktreeSortMode = 'name' | 'recent'
export type WorktreeFilter = 'all' | 'active'
export type PanelTab = 'changes' | 'all-files' | 'checks'

export interface TerminalState {
  id: string
  session: TerminalSession
  status: AgentStatus
  lastOutputTimestamp: number
}

export interface TerminalsSlice {
  terminals: Map<string, TerminalState>
  addTerminal: (session: TerminalSession) => void
  removeTerminal: (id: string) => void
  updateStatus: (id: string, status: AgentStatus) => void
  updateLastOutput: (id: string, timestamp: number) => void
  renameTerminal: (id: string, displayName: string) => void
  updateSessionBranch: (id: string, branch: string) => void
  togglePinned: (id: string) => void

  // Headless agent tracking
  headlessSessions: HeadlessSession[]
  headlessLastOutput: Map<string, string>
  headlessDismissed: Set<string>
  setHeadlessSessions: (sessions: HeadlessSession[]) => void
  addHeadlessSession: (session: HeadlessSession) => void
  updateHeadlessSession: (id: string, updates: Partial<HeadlessSession>) => void
  dismissHeadlessSession: (id: string) => void
  pruneExitedHeadless: (retentionMs: number) => void
  setHeadlessLastOutput: (id: string, line: string) => void
}

export interface ProjectsSlice {
  config: AppConfig | null
  activeProject: string | null
  activeWorktreePath: string | null
  setConfig: (config: AppConfig) => void
  setActiveProject: (name: string | null) => void
  setActiveWorktreePath: (path: string | null) => void
  addProject: (project: ProjectConfig) => void
  removeProject: (name: string) => void
  updateProject: (originalName: string, project: ProjectConfig) => void
  addWorkflow: (workflow: WorkflowDefinition) => void
  removeWorkflow: (id: string) => void
  updateWorkflow: (id: string, workflow: WorkflowDefinition) => void
  addRemoteHost: (host: RemoteHost) => void
  removeRemoteHost: (id: string) => void
  updateRemoteHost: (id: string, host: RemoteHost) => void
  addWorkspace: (workspace: WorkspaceConfig) => void
  removeWorkspace: (id: string) => void
  updateWorkspace: (id: string, updates: Partial<WorkspaceConfig>) => void
}

export type SettingsCategory =
  | 'appearance'
  | 'general'
  | 'notifications'
  | 'agents'
  | 'hosts'
  | 'keys'
  | 'mcp'
  | 'network'
  | 'about'

export interface UISlice {
  activeWorkspace: string
  focusedTerminalId: string | null
  selectedTerminalId: string | null
  renamingTerminalId: string | null
  isSidebarOpen: boolean
  isNewAgentDialogOpen: boolean
  isAddProjectDialogOpen: boolean
  isWorkflowEditorOpen: boolean
  editingWorkflowId: string | null
  editingProject: ProjectConfig | null
  isCommandPaletteOpen: boolean
  isShortcutsPanelOpen: boolean
  isSettingsOpen: boolean
  settingsCategory: SettingsCategory
  showSessionBanner: boolean
  previousSessions: TerminalSession[]
  gridColumns: number // 0 = auto
  rowHeight: number
  sortMode: SortMode
  statusFilter: StatusFilter
  terminalOrder: string[]
  visibleTerminalIds: string[]
  minimizedTerminals: Set<string>
  isOnboardingOpen: boolean
  diffSidebarTerminalId: string | null
  gitDiffStats: Map<string, GitDiffStat>
  rightPanelTab: PanelTab
  isDiffPanelMaximized: boolean
  diffPanelWidth: number
  mainViewMode: 'sessions' | 'tasks'
  selectedTaskId: string | null
  taskStatusFilter: TaskStatusFilter
  isTaskDialogOpen: boolean
  taskDialogDefaultStatus: TaskStatus
  editingTask: TaskConfig | null
  isTerminalPanelOpen: boolean
  terminalPanelHeight: number
  activeTabId: string | null
  shellTabs: { id: string; title: string }[]
  activeShellTab: string | null
  setActiveWorkspace: (id: string) => void
  setFocusedTerminal: (id: string | null) => void
  setSelectedTerminal: (id: string | null) => void
  setRenamingTerminalId: (id: string | null) => void
  setSortMode: (mode: SortMode) => void
  setStatusFilter: (filter: StatusFilter) => void
  toggleSidebar: () => void
  setNewAgentDialogOpen: (open: boolean) => void
  setAddProjectDialogOpen: (open: boolean) => void
  setWorkflowEditorOpen: (open: boolean) => void
  setEditingWorkflowId: (id: string | null) => void
  setEditingProject: (project: ProjectConfig | null) => void
  setCommandPaletteOpen: (open: boolean) => void
  setShortcutsPanelOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setSettingsCategory: (cat: SettingsCategory) => void
  setSessionBanner: (show: boolean, sessions?: TerminalSession[]) => void
  setGridColumns: (cols: number) => void
  setRowHeight: (height: number) => void
  setTerminalOrder: (order: string[]) => void
  setVisibleTerminalIds: (ids: string[]) => void
  reorderTerminals: (fromIndex: number, toIndex: number) => void
  toggleMinimized: (id: string) => void
  setOnboardingOpen: (open: boolean) => void
  setDiffSidebarTerminalId: (id: string | null) => void
  updateGitDiffStat: (terminalId: string, stat: GitDiffStat) => void
  updateGitDiffStats: (stats: Map<string, GitDiffStat>) => void
  setRightPanelTab: (tab: PanelTab) => void
  setDiffPanelMaximized: (maximized: boolean) => void
  setDiffPanelWidth: (width: number) => void
  setMainViewMode: (mode: 'sessions' | 'tasks') => void
  setSelectedTaskId: (id: string | null) => void
  setTaskStatusFilter: (filter: TaskStatusFilter) => void
  setTaskDialogOpen: (open: boolean, defaultStatus?: TaskStatus) => void
  setEditingTask: (task: TaskConfig | null) => void
  toggleTerminalPanel: () => void
  setTerminalPanelHeight: (height: number) => void
  setActiveTabId: (id: string | null) => void
  addShellTab: (tab: { id: string; title: string }) => void
  removeShellTab: (id: string) => void
  setActiveShellTab: (id: string | null) => void
  renameShellTab: (id: string, title: string) => void
  workflowExecutions: Map<string, WorkflowExecution>
  setWorkflowExecution: (id: string, execution: WorkflowExecution) => void
  updateVersion: string | null
  setUpdateVersion: (version: string | null) => void
  archivedSessions: ArchivedSession[]
  showArchivedSessions: boolean
  setShowArchivedSessions: (show: boolean) => void
  loadArchivedSessions: () => Promise<void>
  archiveSession: (id: string) => Promise<void>
  unarchiveSession: (id: string) => Promise<void>
  worktreeCache: Map<string, WorktreeInfo[]>
  loadWorktrees: (projectPath: string) => Promise<void>
  sidebarProjectSort: ProjectSortMode
  sidebarWorktreeSort: WorktreeSortMode
  sidebarWorktreeFilter: WorktreeFilter
  setSidebarProjectSort: (mode: ProjectSortMode) => void
  setSidebarWorktreeSort: (mode: WorktreeSortMode) => void
  setSidebarWorktreeFilter: (filter: WorktreeFilter) => void
  reorderProjects: (fromIndex: number, toIndex: number) => void
}

export interface TasksSlice {
  getTasksForProject: (projectName: string) => TaskConfig[]
  getTaskQueue: (projectName: string) => TaskConfig[]
  getNextTask: (projectName: string) => TaskConfig | undefined
  addTask: (task: TaskConfig) => void
  removeTask: (id: string) => void
  updateTask: (id: string, updates: Partial<TaskConfig>) => void
  reorderTask: (id: string, newOrder: number) => void
  startTask: (id: string, sessionId: string, agentType: AgentType, worktreePath?: string) => void
  completeTask: (id: string) => void
  reviewTask: (id: string) => void
  cancelTask: (id: string) => void
  reopenTask: (id: string) => void
}

export type AppStore = TerminalsSlice & ProjectsSlice & UISlice & TasksSlice
