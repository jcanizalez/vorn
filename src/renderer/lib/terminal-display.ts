import { TerminalSession } from '../../shared/types'

export function getDisplayName(session: TerminalSession): string {
  return session.displayName?.trim() || session.projectName
}
