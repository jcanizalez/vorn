import { StateCreator } from 'zustand'
import { AppStore, ProjectsSlice } from './types'

export const createProjectsSlice: StateCreator<AppStore, [], [], ProjectsSlice> = (set) => ({
  config: null,
  activeProject: null,

  setConfig: (config) =>
    set({
      config,
      rowHeight: config.defaults.rowHeight || 208,
      activeWorkspace: config.defaults.activeWorkspace ?? 'personal'
    }),

  setActiveProject: (name) => set({ activeProject: name }),

  addProject: (project) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        projects: [...state.config.projects, project]
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  removeProject: (name) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        projects: state.config.projects.filter((p) => p.name !== name)
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  updateProject: (originalName, project) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        projects: state.config.projects.map((p) => (p.name === originalName ? project : p))
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  addWorkflow: (workflow) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        workflows: [...(state.config.workflows || []), workflow]
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  removeWorkflow: (id) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        workflows: (state.config.workflows || []).filter((w) => w.id !== id)
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  updateWorkflow: (id, workflow) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        workflows: (state.config.workflows || []).map((w) => (w.id === id ? workflow : w))
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  addRemoteHost: (host) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        remoteHosts: [...(state.config.remoteHosts || []), host]
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  removeRemoteHost: (id) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        remoteHosts: (state.config.remoteHosts || []).filter((h) => h.id !== id)
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  updateRemoteHost: (id, host) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        remoteHosts: (state.config.remoteHosts || []).map((h) => (h.id === id ? host : h))
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  addWorkspace: (workspace) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        workspaces: [...(state.config.workspaces || []), workspace]
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  removeWorkspace: (id) =>
    set((state) => {
      if (!state.config || id === 'personal') return {}
      // Move projects and workflows from deleted workspace to 'personal'
      const updated = {
        ...state.config,
        workspaces: (state.config.workspaces || []).filter((ws) => ws.id !== id),
        projects: state.config.projects.map((p) =>
          (p.workspaceId ?? 'personal') === id ? { ...p, workspaceId: 'personal' } : p
        ),
        workflows: (state.config.workflows || []).map((w) =>
          (w.workspaceId ?? 'personal') === id ? { ...w, workspaceId: 'personal' } : w
        )
      }
      window.api.saveConfig(updated)
      // If active workspace is being deleted, switch to personal
      const activeWorkspace = state.activeWorkspace === id ? 'personal' : state.activeWorkspace
      return { config: updated, activeWorkspace }
    }),

  updateWorkspace: (id, updates) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        workspaces: (state.config.workspaces || []).map((ws) =>
          ws.id === id ? { ...ws, ...updates } : ws
        )
      }
      window.api.saveConfig(updated)
      return { config: updated }
    })
})
