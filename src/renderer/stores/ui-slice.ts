import { StateCreator } from 'zustand'
import { AppStore, UISlice } from './types'

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
  } catch { /* ignore */ }
}

const savedGrid = loadGridSettings()

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  focusedTerminalId: null,
  selectedTerminalId: null,
  renamingTerminalId: null,
  isSidebarOpen: true,
  isNewAgentDialogOpen: false,
  isAddProjectDialogOpen: false,
  isShortcutDialogOpen: false,
  editingProject: null,
  editingShortcut: null,
  isCommandPaletteOpen: false,
  isShortcutsPanelOpen: false,
  isSettingsOpen: false,
  settingsCategory: 'general',
  showSessionBanner: false,
  previousSessions: [],
  gridColumns: (savedGrid.gridColumns as number) ?? 0,
  rowHeight: 208,
  sortMode: (savedGrid.sortMode as 'manual' | 'created' | 'recent') ?? 'manual',
  statusFilter: (savedGrid.statusFilter as 'all' | 'running' | 'waiting' | 'idle' | 'error') ?? 'all',
  terminalOrder: [],
  visibleTerminalIds: [],
  minimizedTerminals: new Set(),
  isOnboardingOpen: false,
  diffSidebarTerminalId: null,
  gitDiffStats: new Map(),
  isTaskPanelOpen: false,
  isTaskDialogOpen: false,
  editingTask: null,
  isTerminalPanelOpen: false,
  terminalPanelHeight: 250,
  shellTabs: [],
  activeShellTab: null,

  setFocusedTerminal: (id) =>
    set(() => ({
      focusedTerminalId: id,
      selectedTerminalId: id
    })),
  setSelectedTerminal: (id) => set({ selectedTerminalId: id }),
  setRenamingTerminalId: (id) => set({ renamingTerminalId: id }),
  setSortMode: (mode) => { saveGridSettings({ sortMode: mode }); set({ sortMode: mode }) },
  setStatusFilter: (filter) => { saveGridSettings({ statusFilter: filter }); set({ statusFilter: filter }) },

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setNewAgentDialogOpen: (open) => set({ isNewAgentDialogOpen: open }),

  setAddProjectDialogOpen: (open) => set({ isAddProjectDialogOpen: open }),

  setShortcutDialogOpen: (open) => set({ isShortcutDialogOpen: open }),

  setEditingProject: (project) => set({ editingProject: project }),

  setEditingShortcut: (shortcut) => set({ editingShortcut: shortcut }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setShortcutsPanelOpen: (open) => set({ isShortcutsPanelOpen: open }),

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setSettingsCategory: (cat) => set({ settingsCategory: cat }),

  setSessionBanner: (show, sessions) =>
    set({
      showSessionBanner: show,
      previousSessions: sessions || []
    }),

  setGridColumns: (cols) => { saveGridSettings({ gridColumns: cols }); set({ gridColumns: cols }) },

  setRowHeight: (height) =>
    set((state) => {
      if (state.config) {
        const updated = {
          ...state.config,
          defaults: { ...state.config.defaults, rowHeight: height }
        }
        window.api.saveConfig(updated)
      }
      return { rowHeight: height }
    }),

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
  setDiffSidebarTerminalId: (id) => set({ diffSidebarTerminalId: id }),

  updateGitDiffStat: (terminalId, stat) =>
    set((state) => {
      const next = new Map(state.gitDiffStats)
      next.set(terminalId, stat)
      return { gitDiffStats: next }
    }),

  setTaskPanelOpen: (open) => set({ isTaskPanelOpen: open }),
  setTaskDialogOpen: (open) => set({ isTaskDialogOpen: open }),
  setEditingTask: (task) => set({ editingTask: task }),

  toggleTerminalPanel: () =>
    set((state) => ({ isTerminalPanelOpen: !state.isTerminalPanelOpen })),

  setTerminalPanelHeight: (height) =>
    set({ terminalPanelHeight: height }),

  addShellTab: (tab) =>
    set((state) => ({
      shellTabs: [...state.shellTabs, tab],
      activeShellTab: tab.id
    })),

  removeShellTab: (id) =>
    set((state) => {
      const tabs = state.shellTabs.filter((t) => t.id !== id)
      const active = state.activeShellTab === id
        ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
        : state.activeShellTab
      return { shellTabs: tabs, activeShellTab: active }
    }),

  setActiveShellTab: (id) =>
    set({ activeShellTab: id }),

  renameShellTab: (id, title) =>
    set((state) => ({
      shellTabs: state.shellTabs.map((t) =>
        t.id === id ? { ...t, title } : t
      )
    })),

  updateVersion: null,
  setUpdateVersion: (version) => set({ updateVersion: version })
})
