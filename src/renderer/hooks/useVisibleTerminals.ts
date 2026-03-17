import { useMemo, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../stores'

export function useVisibleTerminals(): string[] {
  const {
    terminals,
    activeProject,
    activeWorkspace,
    projects,
    sortMode,
    statusFilter,
    terminalOrder,
    setVisibleTerminalIds
  } = useAppStore(
    useShallow((s) => ({
      terminals: s.terminals,
      activeProject: s.activeProject,
      activeWorkspace: s.activeWorkspace,
      projects: s.config?.projects,
      sortMode: s.sortMode,
      statusFilter: s.statusFilter,
      terminalOrder: s.terminalOrder,
      setVisibleTerminalIds: s.setVisibleTerminalIds
    }))
  )

  const workspaceProjects = useMemo(() => {
    if (!projects) return null
    return new Set(
      projects.filter((p) => (p.workspaceId ?? 'personal') === activeWorkspace).map((p) => p.name)
    )
  }, [projects, activeWorkspace])

  const orderedIds = useMemo(
    () =>
      Array.from(terminals.entries())
        .filter(([, t]) => {
          if (activeProject && t.session.projectName !== activeProject) return false
          if (!activeProject && workspaceProjects && !workspaceProjects.has(t.session.projectName))
            return false
          if (statusFilter !== 'all' && t.status !== statusFilter) return false
          return true
        })
        .sort(([aId, aState], [bId, bState]) => {
          switch (sortMode) {
            case 'created':
              return bState.session.createdAt - aState.session.createdAt
            case 'recent':
              return bState.lastOutputTimestamp - aState.lastOutputTimestamp
            case 'manual':
            default: {
              const ia = terminalOrder.indexOf(aId)
              const ib = terminalOrder.indexOf(bId)
              return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
            }
          }
        })
        .map(([id]) => id),
    [terminals, activeProject, workspaceProjects, statusFilter, sortMode, terminalOrder]
  )

  useEffect(() => {
    setVisibleTerminalIds(orderedIds)
    const sel = useAppStore.getState().selectedTerminalId
    if (sel && !orderedIds.includes(sel)) {
      useAppStore.getState().setSelectedTerminal(null)
    }
  }, [orderedIds, setVisibleTerminalIds])

  return orderedIds
}
