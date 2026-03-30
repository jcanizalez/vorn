import { StateCreator } from 'zustand'
import { TerminalSession } from '../../shared/types'
import { AppStore, UISlice } from './types'

const EMPTY_SESSIONS: TerminalSession[] = []
const GRID_STORAGE_KEY = 'vibegrid:gridSettings'

function loadGridSettings(): { gridColumns?: number; sortMode?: string; statusFilter?: string } {
  try {
    const raw = localStorage.getItem(GRID_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveGridSettings(patch: Record<string, unknown>): void {
  try {
    const current = loadGridSettings()
    localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify({ ...current, ...patch }))
  } catch {
    /* ignore */
  }
}

const savedGrid = loadGridSettings()

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  activeWorkspace: 'personal',
  focusedTerminalId: null,
  selectedTerminalId: null,
  renamingTerminalId: null,
  isSidebarOpen: true,
  isNewAgentDialogOpen: false,
  isAddProjectDialogOpen: false,
  isWorkflowEditorOpen: false,
  editingWorkflowId: null,
  editingProject: null,
  isCommandPaletteOpen: false,
  isShortcutsPanelOpen: false,
  isSettingsOpen: false,
  settingsCategory: 'appearance',
  showSessionBanner: false,
  previousSessions: [],
  gridColumns: (savedGrid.gridColumns as number) ?? 0,
  rowHeight: 208,
  sortMode: (savedGrid.sortMode as 'manual' | 'created' | 'recent') ?? 'manual',
  statusFilter:
    (savedGrid.statusFilter as 'all' | 'running' | 'waiting' | 'idle' | 'error') ?? 'all',
  terminalOrder: [],
  visibleTerminalIds: [],
  minimizedTerminals: new Set(),
  isOnboardingOpen: false,
  diffSidebarTerminalId: null,
  diffReviewTaskId: null,
  gitDiffStats: new Map(),
  rightPanelTab: 'changes',
  isDiffPanelMaximized: false,
  diffPanelWidth: 480,
  mainViewMode: 'sessions' as const,
  selectedTaskId: null,
  taskStatusFilter: 'all' as const,
  isTaskPanelOpen: false,
  isTaskDialogOpen: false,
  taskDialogDefaultStatus: 'todo' as const,
  editingTask: null,
  isTerminalPanelOpen: false,
  terminalPanelHeight: 250,
  activeTabId: null,
  shellTabs: [],
  activeShellTab: null,

  setActiveWorkspace: (id) => {
    const config = get().config
    if (config) {
      const updated = { ...config, defaults: { ...config.defaults, activeWorkspace: id } }
      window.api.saveConfig(updated)
      set({ activeWorkspace: id, activeProject: null, config: updated })
    } else {
      set({ activeWorkspace: id, activeProject: null })
    }
  },
  setFocusedTerminal: (id) =>
    set(() => ({
      focusedTerminalId: id,
      selectedTerminalId: id
    })),
  setSelectedTerminal: (id) => set({ selectedTerminalId: id }),
  setRenamingTerminalId: (id) => set({ renamingTerminalId: id }),
  setSortMode: (mode) => {
    saveGridSettings({ sortMode: mode })
    set({ sortMode: mode })
  },
  setStatusFilter: (filter) => {
    saveGridSettings({ statusFilter: filter })
    set({ statusFilter: filter })
  },

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setNewAgentDialogOpen: (open) => set({ isNewAgentDialogOpen: open }),

  setAddProjectDialogOpen: (open) => set({ isAddProjectDialogOpen: open }),

  setWorkflowEditorOpen: (open) => set({ isWorkflowEditorOpen: open }),

  setEditingWorkflowId: (id) => set({ editingWorkflowId: id }),

  setEditingProject: (project) => set({ editingProject: project }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setShortcutsPanelOpen: (open) => set({ isShortcutsPanelOpen: open }),

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setSettingsCategory: (cat) => set({ settingsCategory: cat }),

  setSessionBanner: (show, sessions) =>
    set({
      showSessionBanner: show,
      previousSessions: sessions ?? EMPTY_SESSIONS
    }),

  setGridColumns: (cols) => {
    saveGridSettings({ gridColumns: cols })
    set({ gridColumns: cols })
  },

  setRowHeight: (height) => {
    const config = get().config
    if (config) {
      const updated = { ...config, defaults: { ...config.defaults, rowHeight: height } }
      window.api.saveConfig(updated)
      set({ rowHeight: height, config: updated })
    } else {
      set({ rowHeight: height })
    }
  },

  setTerminalOrder: (order) => set({ terminalOrder: order }),
  setVisibleTerminalIds: (ids) => set({ visibleTerminalIds: ids }),

  reorderTerminals: (fromIndex, toIndex) =>
    set((state) => {
      const order = [...state.terminalOrder]
      const [moved] = order.splice(fromIndex, 1)
      order.splice(toIndex, 0, moved)
      return { terminalOrder: order }
    }),

  toggleMinimized: (id) =>
    set((state) => {
      const next = new Set(state.minimizedTerminals)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { minimizedTerminals: next }
    }),

  setOnboardingOpen: (open) => set({ isOnboardingOpen: open }),
  setDiffSidebarTerminalId: (id) =>
    set({ diffSidebarTerminalId: id, rightPanelTab: 'changes', isDiffPanelMaximized: false }),
  setDiffReviewTaskId: (id) => set({ diffReviewTaskId: id }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setDiffPanelMaximized: (maximized) => set({ isDiffPanelMaximized: maximized }),
  setDiffPanelWidth: (width) => set({ diffPanelWidth: width }),

  updateGitDiffStat: (terminalId, stat) =>
    set((state) => {
      const next = new Map(state.gitDiffStats)
      next.set(terminalId, stat)
      return { gitDiffStats: next }
    }),

  updateGitDiffStats: (stats) =>
    set((state) => {
      const next = new Map(state.gitDiffStats)
      for (const [id, stat] of stats) {
        next.set(id, stat)
      }
      return { gitDiffStats: next }
    }),

  setMainViewMode: (mode) => {
    const config = get().config
    const extra = mode !== 'sessions' ? { diffSidebarTerminalId: null } : {}
    if (config) {
      const updated = { ...config, defaults: { ...config.defaults, mainViewMode: mode } }
      window.api.saveConfig(updated)
      set({ mainViewMode: mode, config: updated, ...extra })
    } else {
      set({ mainViewMode: mode, ...extra })
    }
  },
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setTaskStatusFilter: (filter) => set({ taskStatusFilter: filter }),
  setTaskPanelOpen: (open) => set({ isTaskPanelOpen: open }),
  setTaskDialogOpen: (open, defaultStatus) =>
    set({ isTaskDialogOpen: open, taskDialogDefaultStatus: defaultStatus ?? 'todo' }),
  setEditingTask: (task) => set({ editingTask: task }),

  toggleTerminalPanel: () => set((state) => ({ isTerminalPanelOpen: !state.isTerminalPanelOpen })),

  setTerminalPanelHeight: (height) => set({ terminalPanelHeight: height }),

  setActiveTabId: (id) => set({ activeTabId: id }),

  addShellTab: (tab) =>
    set((state) => ({
      shellTabs: [...state.shellTabs, tab],
      activeShellTab: tab.id
    })),

  removeShellTab: (id) =>
    set((state) => {
      const tabs = state.shellTabs.filter((t) => t.id !== id)
      const active =
        state.activeShellTab === id
          ? tabs.length > 0
            ? tabs[tabs.length - 1].id
            : null
          : state.activeShellTab
      return { shellTabs: tabs, activeShellTab: active }
    }),

  setActiveShellTab: (id) => set({ activeShellTab: id }),

  renameShellTab: (id, title) =>
    set((state) => ({
      shellTabs: state.shellTabs.map((t) => (t.id === id ? { ...t, title } : t))
    })),

  workflowExecutions: new Map(),
  setWorkflowExecution: (id, execution) =>
    set((state) => {
      const next = new Map(state.workflowExecutions)
      next.set(id, execution)
      return { workflowExecutions: next }
    }),

  updateVersion: null,
  setUpdateVersion: (version) => set({ updateVersion: version }),

  archivedSessions: [],
  showArchivedSessions: false,
  setShowArchivedSessions: (show) => set({ showArchivedSessions: show }),

  loadArchivedSessions: async () => {
    const sessions = await window.api.listArchivedSessions()
    set({ archivedSessions: sessions })
  },

  archiveSession: async (id) => {
    const term = get().terminals.get(id)
    if (!term) return
    await window.api.archiveSession({
      id: term.id,
      agentType: term.session.agentType,
      projectName: term.session.projectName,
      projectPath: term.session.projectPath,
      displayName: term.session.displayName,
      branch: term.session.branch,
      agentSessionId: term.session.hookSessionId,
      archivedAt: Date.now()
    })
    const sessions = await window.api.listArchivedSessions()
    set((state) => {
      const terminals = new Map(state.terminals)
      terminals.delete(id)
      const terminalOrder = state.terminalOrder.filter((tid) => tid !== id)
      const minimizedTerminals = new Set(state.minimizedTerminals)
      minimizedTerminals.delete(id)
      const gitDiffStats = new Map(state.gitDiffStats)
      gitDiffStats.delete(id)
      return {
        terminals,
        terminalOrder,
        minimizedTerminals,
        gitDiffStats,
        archivedSessions: sessions
      }
    })
    window.api.notifyWidgetStatus()
  },

  unarchiveSession: async (id) => {
    await window.api.unarchiveSession(id)
    const sessions = await window.api.listArchivedSessions()
    set({ archivedSessions: sessions })
  },

  worktreeCache: new Map(),
  loadWorktrees: async (projectPath) => {
    const worktrees = await window.api.listWorktrees(projectPath)
    const terminals = get().terminals

    const enriched = await Promise.all(
      worktrees
        .filter((wt) => !wt.isMain)
        .map(async (wt) => {
          const isDirty = await window.api.isWorktreeDirty(wt.path)
          const diffStat = isDirty
            ? ((await window.api.getGitDiffStat(wt.path)) ?? undefined)
            : undefined
          let linkedSessionId: string | undefined
          for (const [id, t] of terminals) {
            if (t.session.worktreePath === wt.path) {
              linkedSessionId = id
              break
            }
          }
          return { ...wt, isDirty, diffStat, linkedSessionId }
        })
    )

    set((state) => {
      const next = new Map(state.worktreeCache)
      next.set(projectPath, enriched)
      return { worktreeCache: next }
    })
  }
})
