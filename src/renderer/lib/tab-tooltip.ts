import type { AgentStatus } from '../../shared/types'

const STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  error: 'Error'
}

export function buildTooltip(
  displayName: string,
  status: AgentStatus,
  branch?: string,
  isWorktree?: boolean,
  taskTitle?: string,
  shellCwd?: string,
  shellExitCode?: number
): string {
  const lines = [`${displayName} — ${STATUS_LABEL[status]}`]
  if (branch) {
    lines.push(`Branch: ${branch}${isWorktree ? ' (worktree)' : ''}`)
  }
  if (taskTitle) {
    lines.push(`Task: ${taskTitle}`)
  }
  if (shellCwd) {
    lines.push(`Cwd: ${shellCwd}`)
  }
  if (shellExitCode !== undefined) {
    lines.push(`Exit: ${shellExitCode}`)
  }
  return lines.join('\n')
}
