import type { TerminalSession, RecentSession } from '../../shared/types'

/**
 * Resolve the agent session ID to pass as --resume when restoring a session.
 * Falls back through progressively looser matching strategies.
 *
 * @param claimed - session IDs already assigned to other terminals in this
 *   restore batch; prevents multiple terminals from resuming the same session.
 */
export async function resolveResumeSessionId(
  s: TerminalSession,
  claimed: Set<string> = new Set()
): Promise<string | undefined> {
  if (s.hookSessionId && !claimed.has(s.hookSessionId)) return s.hookSessionId

  const isAvailable = (r: RecentSession): boolean =>
    r.agentType === s.agentType && !claimed.has(r.sessionId)

  // Scoped fetch first — the global unscoped list has a default limit of 20,
  // so a project's sessions may not appear in the global results.
  try {
    const scopedRecent = await window.api.getRecentSessions(s.projectPath)
    const scopedMatch = scopedRecent.find(isAvailable)
    if (scopedMatch) return scopedMatch.sessionId
  } catch {
    // Scoped fetch failed — fall through to unscoped lookup
  }

  // Unscoped fallback for looser matching (path normalization mismatches)
  const allRecent = await window.api.getRecentSessions()

  // Exact project path match
  const exact = allRecent.find((r) => isAvailable(r) && r.projectPath === s.projectPath)
  if (exact) return exact.sessionId

  // Case-insensitive basename match (handles symlinks, trailing-slash diffs)
  const basename = s.projectPath.replace(/\/+$/, '').split('/').pop()?.toLowerCase()
  if (basename) {
    const fuzzy = allRecent.find((r) => {
      if (!isAvailable(r)) return false
      const candidateBase = r.projectPath.replace(/\/+$/, '').split('/').pop()?.toLowerCase()
      return candidateBase === basename
    })
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
  const normalized = session.projectPath.replace(/\/+$/, '')
  if (!projects) return normalized.split('/').pop() || 'untitled'

  const project = projects.find((p) => {
    if (p.path === session.projectPath) return true
    return p.path.replace(/\/+$/, '') === normalized
  })
  return project?.name || normalized.split('/').pop() || 'untitled'
}
