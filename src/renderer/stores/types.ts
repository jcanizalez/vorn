import { AgentStatus, AgentType, AppConfig, ProjectConfig, ShortcutConfig, RemoteHost, TerminalSession, GitDiffStat, TaskConfig } from '../../shared/types'

export type SortMode = 'manual' | 'created' | 'recent'
export type StatusFilter = AgentStatus | 'all'

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
}

export interface ProjectsSlice {
  config: AppConfig | null
  activeProject: string | null
  setConfig: (config: AppConfig) => void
  setActiveProject: (name: string | null) => void
  addProject: (project: ProjectConfig) => void
  removeProject: (name: string) => void
  updateProject: (originalName: string, project: ProjectConfig) => void
  addShortcut: (shortcut: ShortcutConfig) => void
  removeShortcut: (id: string) => void
  updateShortcut: (id: string, shortcut: ShortcutConfig) => void
  addRemoteHost: (host: RemoteHost) => void
  removeRemoteHost: (id: string) => void
  updateRemoteHost: (id: string, host: RemoteHost) => void
}

export type SettingsCategory = 'general' | 'agents' | 'hosts'

export interface UISlice {
  focusedTerminalId: string | null
  selectedTerminalId: string | null
  renamingTerminalId: string | null
  isSidebarOpen: boolean
  isNewAgentDialogOpen: boolean
  isAddProjectDialogOpen: boolean
  isShortcutDialogOpen: boolean
  editingProject: ProjectConfig | null
  editingShortcut: ShortcutConfig | null
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
  isTaskPanelOpen: boolean
  isTaskDialogOpen: boolean
  editingTask: TaskConfig | null
  isTerminalPanelOpen: boolean
  terminalPanelHeight: number
  shellTabs: { id: string; title: string }[]
  activeShellTab: string | null
  setFocusedTerminal: (id: string | null) => void
  setSelectedTerminal: (id: string | null) => void
  setRenamingTerminalId: (id: string | null) => void
  setSortMode: (mode: SortMode) => void
  setStatusFilter: (filter: StatusFilter) => void
  toggleSidebar: () => void
  setNewAgentDialogOpen: (open: boolean) => void
  setAddProjectDialogOpen: (open: boolean) => void
  setShortcutDialogOpen: (open: boolean) => void
  setEditingProject: (project: ProjectConfig | null) => void
  setEditingShortcut: (shortcut: ShortcutConfig | null) => void
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
  setTaskPanelOpen: (open: boolean) => void
  setTaskDialogOpen: (open: boolean) => void
  setEditingTask: (task: TaskConfig | null) => void
  toggleTerminalPanel: () => void
  setTerminalPanelHeight: (height: number) => void
  addShellTab: (tab: { id: string; title: string }) => void
  removeShellTab: (id: string) => void
  setActiveShellTab: (id: string | null) => void
  renameShellTab: (id: string, title: string) => void
  updateVersion: string | null
  setUpdateVersion: (version: string | null) => void
}

export interface TasksSlice {
  getTasksForProject: (projectName: string) => TaskConfig[]
  getTaskQueue: (projectName: string) => TaskConfig[]
  getNextTask: (projectName: string) => TaskConfig | undefined
  addTask: (task: TaskConfig) => void
  removeTask: (id: string) => void
  updateTask: (id: string, updates: Partial<TaskConfig>) => void
  reorderTask: (id: string, newOrder: number) => void
  startTask: (id: string, sessionId: string, agentType: AgentType) => void
  completeTask: (id: string) => void
}

export type AppStore = TerminalsSlice & ProjectsSlice & UISlice & TasksSlice
