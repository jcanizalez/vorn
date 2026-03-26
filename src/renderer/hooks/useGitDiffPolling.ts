import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores'
import type { GitDiffStat } from '../../shared/types'

const POLL_INTERVAL = 30_000

export function useGitDiffPolling(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const poll = async (): Promise<void> => {
      // Skip polling when window is hidden to save energy
      if (document.hidden) return

      const { terminals, updateGitDiffStats, updateSessionBranch } = useAppStore.getState()

      const entries = Array.from(terminals).filter(([, t]) => !t.session.remoteHostId)

      const batchStats = new Map<string, GitDiffStat>()
      await Promise.allSettled(
        entries.map(async ([id, t]) => {
          const cwd = t.session.worktreePath || t.session.projectPath
          try {
            const [stat, branch] = await Promise.all([
              window.api.getGitDiffStat(cwd),
              window.api.getGitBranch(cwd)
            ])
            if (stat) batchStats.set(id, stat)
            if (branch && branch !== t.session.branch) {
              updateSessionBranch(id, branch)
            }
          } catch {
            // not a git repo or error — skip
          }
        })
      )

      if (batchStats.size > 0) {
        updateGitDiffStats(batchStats)
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])
}
