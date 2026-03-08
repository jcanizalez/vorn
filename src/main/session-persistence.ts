import { TerminalSession } from '../shared/types'
import {
  saveSessions as dbSaveSessions,
  getPreviousSessions as dbGetPreviousSessions,
  clearSessions as dbClearSessions
} from './database'

class SessionManager {
  saveSessions(sessions: TerminalSession[]): void {
    try {
      dbSaveSessions(sessions)
    } catch {
      // ignore write errors
    }
  }

  getPreviousSessions(): TerminalSession[] {
    try {
      return dbGetPreviousSessions()
    } catch {
      return []
    }
  }

  clear(): void {
    try {
      dbClearSessions()
    } catch {
      // ignore
    }
  }
}

export const sessionManager = new SessionManager()
