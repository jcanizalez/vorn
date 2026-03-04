import { StateCreator } from 'zustand'
import { AppStore, TerminalsSlice } from './types'

export const createTerminalsSlice: StateCreator<AppStore, [], [], TerminalsSlice> = (set) => ({
  terminals: new Map(),

  addTerminal: (session) =>
    set((state) => {
      const next = new Map(state.terminals)
      next.set(session.id, {
        id: session.id,
        session,
        status: session.status,
        lastOutputTimestamp: Date.now()
      })
      const order = state.terminalOrder.includes(session.id)
        ? state.terminalOrder
        : [...state.terminalOrder, session.id]
      return { terminals: next, terminalOrder: order }
    }),

  removeTerminal: (id) =>
    set((state) => {
      const next = new Map(state.terminals)
      next.delete(id)
      const order = state.terminalOrder.filter((tid) => tid !== id)
      const minimized = new Set(state.minimizedTerminals)
      minimized.delete(id)
      return { terminals: next, terminalOrder: order, minimizedTerminals: minimized }
    }),

  updateStatus: (id, status) =>
    set((state) => {
      const next = new Map(state.terminals)
      const term = next.get(id)
      if (term) next.set(id, { ...term, status })
      return { terminals: next }
    }),

  updateLastOutput: (id, timestamp) =>
    set((state) => {
      const next = new Map(state.terminals)
      const term = next.get(id)
      if (term) next.set(id, { ...term, lastOutputTimestamp: timestamp })
      return { terminals: next }
    }),

  renameTerminal: (id, displayName) =>
    set((state) => {
      const next = new Map(state.terminals)
      const term = next.get(id)
      if (term) {
        next.set(id, { ...term, session: { ...term.session, displayName } })
      }
      return { terminals: next }
    })
})
