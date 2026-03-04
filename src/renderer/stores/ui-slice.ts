import { StateCreator } from 'zustand'
import { AppStore, UISlice } from './types'

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
  gridColumns: 0,
  rowHeight: 208,
  sortMode: 'manual',
  statusFilter: 'all',
  terminalOrder: [],
  visibleTerminalIds: [],
  minimizedTerminals: new Set(),
  diffSidebarTerminalId: null,
  gitDiffStats: new Map(),

  setFocusedTerminal: (id) =>
    set(() => ({
      focusedTerminalId: id,
      selectedTerminalId: id
    })),
  setSelectedTerminal: (id) => set({ selectedTerminalId: id }),
  setRenamingTerminalId: (id) => set({ renamingTerminalId: id }),
  setSortMode: (mode) => set({ sortMode: mode }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),

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

  setGridColumns: (cols) => set({ gridColumns: cols }),

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

  setDiffSidebarTerminalId: (id) => set({ diffSidebarTerminalId: id }),

  updateGitDiffStat: (terminalId, stat) =>
    set((state) => {
      const next = new Map(state.gitDiffStats)
      next.set(terminalId, stat)
      return { gitDiffStats: next }
    })
})
