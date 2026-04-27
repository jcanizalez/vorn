import { useMemo, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../stores'
import { MAIN_WORKTREE_SENTINEL, type TerminalState } from '../stores/types'

export function useVisibleTerminals(): { orderedIds: string[]; minimizedIds: string[] } {
  const {
    terminals,
    activeProject,
    activeWorktreePath,
    activeWorkspace,
    projects,
    sortMode,
    statusFilter,
    terminalOrder,
    minimizedTerminals,
    setVisibleTerminalIds,
    setFocusableTerminalIds
  } = useAppStore(
    useShallow((s) => ({
      terminals: s.terminals,
      activeProject: s.activeProject,
      activeWorktreePath: s.activeWorktreePath,
      activeWorkspace: s.activeWorkspace,
      projects: s.config?.projects,
      sortMode: s.sortMode,
      statusFilter: s.statusFilter,
      terminalOrder: s.terminalOrder,
      minimizedTerminals: s.minimizedTerminals,
      setVisibleTerminalIds: s.setVisibleTerminalIds,
      setFocusableTerminalIds: s.setFocusableTerminalIds
    }))
  )

  const workspaceProjects = useMemo(() => {
    if (!projects) return null
    return new Set(
      projects.filter((p) => (p.workspaceId ?? 'personal') === activeWorkspace).map((p) => p.name)
    )
  }, [projects, activeWorkspace])

  const { orderedIds, minimizedIds, focusableIds } = useMemo(() => {
    const inActiveScope = (t: TerminalState): boolean => {
      if (activeProject && t.session.projectName !== activeProject) return false
      if (!activeProject && workspaceProjects && !workspaceProjects.has(t.session.projectName))
        return false
      return true
    }
    const sortFn = (
      [aId, aState]: [string, TerminalState],
      [bId, bState]: [string, TerminalState]
    ): number => {
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
    }
    const all = Array.from(terminals.entries())
    const filtered = all
      .filter(([, t]) => {
        if (!inActiveScope(t)) return false
        if (activeWorktreePath) {
          if (activeWorktreePath === MAIN_WORKTREE_SENTINEL) {
            if (t.session.worktreePath) return false
          } else if (t.session.worktreePath !== activeWorktreePath) return false
        }
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        return true
      })
      .sort(sortFn)

    const ordered: string[] = []
    const minimized: string[] = []
    for (const [id] of filtered) {
      if (minimizedTerminals.has(id)) {
        minimized.push(id)
      } else {
        ordered.push(id)
      }
    }

    // Focused-mode nav spans the active project (or workspace) regardless of
    // worktree filter or status filter, so cycling sessions reaches all of them.
    const focusable = all
      .filter(([, t]) => inActiveScope(t))
      .sort(sortFn)
      .map(([id]) => id)

    return { orderedIds: ordered, minimizedIds: minimized, focusableIds: focusable }
  }, [
    terminals,
    activeProject,
    activeWorktreePath,
    workspaceProjects,
    statusFilter,
    sortMode,
    terminalOrder,
    minimizedTerminals
  ])

  useEffect(() => {
    setVisibleTerminalIds(orderedIds)
    const sel = useAppStore.getState().selectedTerminalId
    if (sel && !orderedIds.includes(sel)) {
      useAppStore.getState().setSelectedTerminal(null)
    }
  }, [orderedIds, setVisibleTerminalIds])

  useEffect(() => {
    setFocusableTerminalIds(focusableIds)
  }, [focusableIds, setFocusableTerminalIds])

  return { orderedIds, minimizedIds }
}
