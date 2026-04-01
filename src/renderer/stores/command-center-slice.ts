import { StateCreator } from 'zustand'
import { AppStore, CommandCenterSlice } from './types'

export const createCommandCenterSlice: StateCreator<AppStore, [], [], CommandCenterSlice> = (
  set
) => ({
  ccProjectFilter: 'all',
  setCcProjectFilter: (project) => set({ ccProjectFilter: project })
})
