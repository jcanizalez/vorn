import {
  supportsExactSessionResume,
  type TerminalSession,
  type RecentSession,
  type CreateTerminalPayload
} from '../../shared/types'
import { useAppStore } from '../stores'

function normalizeComparablePath(p: string): string {
  const normalized = p.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized) return '/'
  return normalized.toLowerCase()
}

function getDisplayPathBasename(p: string): string | undefined {
  const normalized = p.replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalized || normalized === '/') return undefined
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : undefined
}

function getManagedWorktreePrefix(projectPath: string): string | null {
  const normalized = normalizeComparablePath(projectPath)
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return null

  const projectName = parts[parts.length - 1]
  if (!projectName) return null

  const prefix = normalized.startsWith('/') ? '/' : ''
  const parent = parts.slice(0, -1).join('/')
  const parentPath = parent ? `${prefix}${parent}` : prefix || '.'
  return `${parentPath}/.vibegrid-worktrees/${projectName}`
}

function isManagedWorktreePath(candidatePath: string, projectPath: string): boolean {
  const prefix = getManagedWorktreePrefix(projectPath)
  if (!prefix) return false
  return normalizeComparablePath(candidatePath).startsWith(`${prefix}/`)
}

function pluralizeActivityLabel(label: string, count: number): string {
  if (count === 1) return label
  if (label.endsWith('y')) return `${label.slice(0, -1)}ies`
  return `${label}s`
}

export function formatRecentSessionActivity(
  session: Pick<RecentSession, 'activityCount' | 'activityLabel'>
): string {
  return `${session.activityCount} ${pluralizeActivityLabel(session.activityLabel, session.activityCount)}`
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

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
  if (!supportsExactSessionResume(s.agentType)) return undefined
  if (s.hookSessionId && !claimed.has(s.hookSessionId)) return s.hookSessionId

  const isAvailable = (r: RecentSession): boolean =>
    r.agentType === s.agentType && r.canResumeExact && !claimed.has(r.sessionId)

  // Worktree sessions: only match sessions created in the same worktree CWD.
  // Claude scopes sessions by CWD, so a session from the base project
  // won't be found when --resume runs in the worktree directory.
  if (s.isWorktree && s.worktreePath) {
    const worktreeNorm = normalizeComparablePath(s.worktreePath)
    try {
      const recent = await window.api.getRecentSessions(s.worktreePath)
      const match = recent.find(
        (r) => isAvailable(r) && normalizeComparablePath(r.projectPath) === worktreeNorm
      )
      if (match) return match.sessionId
    } catch {
      /* no history for this worktree */
    }
    return undefined
  }

  // Non-worktree sessions: progressively looser matching
  const targetPaths = [s.worktreePath, s.projectPath].filter(isDefined).map(normalizeComparablePath)
  const findPreferredPathMatch = (sessions: RecentSession[]): RecentSession | undefined => {
    for (const targetPath of targetPaths) {
      const match = sessions.find(
        (session) =>
          isAvailable(session) && normalizeComparablePath(session.projectPath) === targetPath
      )
      if (match) return match
    }
    return undefined
  }

  // Scoped fetch first — the global unscoped list has a default limit of 20,
  // so a project's sessions may not appear in the global results.
  try {
    const scopedRecent = await window.api.getRecentSessions(s.projectPath)
    const scopedExact = findPreferredPathMatch(scopedRecent)
    if (scopedExact) return scopedExact.sessionId

    const scopedMatch = scopedRecent.find(isAvailable)
    if (scopedMatch) return scopedMatch.sessionId
  } catch {
    // Scoped fetch failed — fall through to unscoped lookup
  }

  // Unscoped fallback for looser matching (path normalization mismatches)
  const allRecent = await window.api.getRecentSessions()

  // Exact project path match
  const exact = findPreferredPathMatch(allRecent)
  if (exact) return exact.sessionId

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
  const normalized = normalizeComparablePath(session.projectPath)
  const displayBasename = getDisplayPathBasename(session.projectPath)
  if (!projects) return displayBasename || 'untitled'

  const project = projects.find((p) => {
    const projectPath = normalizeComparablePath(p.path)
    return projectPath === normalized || isManagedWorktreePath(session.projectPath, p.path)
  })
  return project?.name || displayBasename || 'untitled'
}

export function buildRestorePayload(
  s: TerminalSession,
  resumeSessionId?: string
): CreateTerminalPayload {
  return {
    agentType: s.agentType,
    projectName: s.projectName,
    projectPath: s.projectPath,
    displayName: s.displayName,
    branch: s.isWorktree ? s.branch : undefined,
    existingWorktreePath: s.isWorktree ? s.worktreePath : undefined,
    useWorktree: (s.isWorktree && !s.worktreePath) || undefined,
    remoteHostId: s.remoteHostId,
    resumeSessionId
  }
}

/**
 * Resolve the currently active project from the store.
 * Falls back to the first project in the active workspace.
 */
export function resolveActiveProject() {
  const state = useAppStore.getState()
  const projects = state.config?.projects
  if (!projects || projects.length === 0) return undefined

  const activeProjectName = state.activeProject
  if (activeProjectName) {
    const match = projects.find((p) => p.name === activeProjectName)
    if (match) return match
  }
  const ws = state.activeWorkspace
  return projects.find((p) => (p.workspaceId ?? 'personal') === ws)
}
