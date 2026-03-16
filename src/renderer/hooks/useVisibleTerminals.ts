import { useMemo, useEffect } from 'react'
import { useAppStore } from '../stores'

export function useVisibleTerminals(): string[] {
  const terminals = useAppStore((s) => s.terminals)
  const activeProject = useAppStore((s) => s.activeProject)
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const projects = useAppStore((s) => s.config?.projects)
  const sortMode = useAppStore((s) => s.sortMode)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const terminalOrder = useAppStore((s) => s.terminalOrder)
  const setVisibleTerminalIds = useAppStore((s) => s.setVisibleTerminalIds)

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
