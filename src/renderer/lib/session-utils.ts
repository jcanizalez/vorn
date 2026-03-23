import type { TerminalSession, RecentSession } from '../../shared/types'

/**
 * Resolve the agent session ID to pass as --resume when restoring a session.
 * Falls back through progressively looser matching strategies.
 */
export async function resolveResumeSessionId(s: TerminalSession): Promise<string | undefined> {
  if (s.hookSessionId) return s.hookSessionId

  // Single unscoped fetch — the scoped call is a strict subset, so one
  // round-trip covers all matching tiers.
  const allRecent = await window.api.getRecentSessions()

  // Exact project path match
  const exact = allRecent.find(
    (r) => r.agentType === s.agentType && r.projectPath === s.projectPath
  )
  if (exact) return exact.sessionId

  // Basename match (handles symlinks, trailing-slash diffs, case variations)
  const basename = s.projectPath.replace(/\/+$/, '').split('/').pop()
  if (basename) {
    const fuzzy = allRecent.find(
      (r) =>
        r.agentType === s.agentType &&
        r.projectPath.replace(/\/+$/, '').split('/').pop() === basename
    )
    if (fuzzy) return fuzzy.sessionId
  }

  return undefined
}

/**
 * Find the best matching project name for a recent session's path.
 * Normalizes trailing slashes for robust matching.
 */
export function resolveProjectName(
  session: RecentSession,
  projects: { name: string; path: string }[] | undefined
): string {
  if (!projects) return session.projectPath.split('/').pop() || 'untitled'

  const normalized = session.projectPath.replace(/\/+$/, '')
  const project = projects.find((p) => {
    if (p.path === session.projectPath) return true
    return p.path.replace(/\/+$/, '') === normalized
  })
  return project?.name || session.projectPath.split('/').pop() || 'untitled'
}
