import { TerminalSession } from '@vibegrid/shared/types'
import {
  saveSessions as dbSaveSessions,
  getPreviousSessions as dbGetPreviousSessions,
  clearSessions as dbClearSessions
} from './database'
import log from './logger'

/** How often to auto-save (ms). Acts as a safety net if event-driven saves miss. */
const AUTO_SAVE_INTERVAL_MS = 30_000

/** Debounce window so rapid session events don't thrash the DB. */
const DEBOUNCE_MS = 500

class SessionManager {
  private getActiveSessions: (() => TerminalSession[]) | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private dirty = false

  /**
   * Wire up a session source so the manager can auto-save on state changes
   * and on a periodic interval (safety net for force-quit / crash).
   */
  startAutoSave(getActiveSessions: () => TerminalSession[]): void {
    this.getActiveSessions = getActiveSessions

    this.intervalTimer = setInterval(() => {
      if (this.dirty) this.persistNow()
    }, AUTO_SAVE_INTERVAL_MS)
  }

  stopAutoSave(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
  }

  scheduleSave(): void {
    if (!this.getActiveSessions) return
    this.dirty = true
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.persistNow()
    }, DEBOUNCE_MS)
  }

  persistNow(): void {
    if (!this.getActiveSessions) return
    this.dirty = false
    const sessions = this.getActiveSessions()
    this.saveSessions(sessions)
  }

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
