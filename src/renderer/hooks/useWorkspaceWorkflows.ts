import { useMemo } from 'react'
import { useAppStore } from '../stores'

/**
 * Returns the workflows belonging to the active workspace.
 */
export function useWorkspaceWorkflows() {
  const workflows = useAppStore((s) => s.config?.workflows)
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  return useMemo(
    () => (workflows ?? []).filter((w) => (w.workspaceId ?? 'personal') === activeWorkspace),
    [workflows, activeWorkspace]
  )
}
