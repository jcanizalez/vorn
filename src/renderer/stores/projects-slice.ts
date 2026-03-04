import { StateCreator } from 'zustand'
import { AppStore, ProjectsSlice } from './types'

export const createProjectsSlice: StateCreator<AppStore, [], [], ProjectsSlice> = (set) => ({
  config: null,
  activeProject: null,

  setConfig: (config) => set({ config, rowHeight: config.defaults.rowHeight || 208 }),

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
        projects: state.config.projects.map((p) =>
          p.name === originalName ? project : p
        )
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  addShortcut: (shortcut) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        shortcuts: [...(state.config.shortcuts || []), shortcut]
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  removeShortcut: (id) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        shortcuts: (state.config.shortcuts || []).filter((s) => s.id !== id)
      }
      window.api.saveConfig(updated)
      return { config: updated }
    }),

  updateShortcut: (id, shortcut) =>
    set((state) => {
      if (!state.config) return {}
      const updated = {
        ...state.config,
        shortcuts: (state.config.shortcuts || []).map((s) =>
          s.id === id ? shortcut : s
        )
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
        remoteHosts: (state.config.remoteHosts || []).map((h) =>
          h.id === id ? host : h
        )
      }
      window.api.saveConfig(updated)
      return { config: updated }
    })
})
