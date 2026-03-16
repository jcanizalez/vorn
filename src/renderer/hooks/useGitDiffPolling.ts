import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores'

const POLL_INTERVAL = 30_000

export function useGitDiffPolling(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async (): Promise<void> => {
      // Skip polling when window is hidden/unfocused to save energy
      if (document.hidden) return

      const { terminals, updateGitDiffStat } = useAppStore.getState()

      for (const [id, t] of terminals) {
        if (t.session.remoteHostId) continue // skip remote sessions
        const cwd = t.session.worktreePath || t.session.projectPath
        try {
          const stat = await window.api.getGitDiffStat(cwd)
          if (stat) updateGitDiffStat(id, stat)
        } catch {
          // not a git repo or error — skip
        }
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}
