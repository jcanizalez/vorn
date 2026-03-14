import { TerminalSession } from '@vibegrid/shared/types'
import {
  saveSessions as dbSaveSessions,
  getPreviousSessions as dbGetPreviousSessions,
  clearSessions as dbClearSessions
} from './database'
import log from './logger'

class SessionManager {
  saveSessions(sessions: TerminalSession[]): void {
    try {
      dbSaveSessions(sessions)
    } catch (err) {
      log.warn('[session-persistence] saveSessions failed:', err)
    }
  }

  getPreviousSessions(): TerminalSession[] {
    try {
      return dbGetPreviousSessions()
    } catch (err) {
      log.warn('[session-persistence] getPreviousSessions failed:', err)
      return []
    }
  }

  clear(): void {
    try {
      dbClearSessions()
    } catch (err) {
      log.warn('[session-persistence] clear failed:', err)
    }
  }
}

export const sessionManager = new SessionManager()
