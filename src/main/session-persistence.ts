import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TerminalSession } from '../shared/types'

const SESSIONS_PATH = path.join(os.homedir(), '.vibegrid', 'sessions.json')

interface SessionsFile {
  savedAt: number
  sessions: TerminalSession[]
}

class SessionManager {
  saveSessions(sessions: TerminalSession[]): void {
    const data: SessionsFile = {
      savedAt: Date.now(),
      sessions
    }
    try {
      fs.writeFileSync(SESSIONS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // ignore write errors
    }
  }

  getPreviousSessions(): TerminalSession[] {
    try {
      if (!fs.existsSync(SESSIONS_PATH)) return []
      const raw = fs.readFileSync(SESSIONS_PATH, 'utf-8')
      const data: SessionsFile = JSON.parse(raw)
      return data.sessions || []
    } catch {
      return []
    }
  }

  clear(): void {
    try {
      if (fs.existsSync(SESSIONS_PATH)) {
        fs.unlinkSync(SESSIONS_PATH)
      }
    } catch {
      // ignore
    }
  }
}

export const sessionManager = new SessionManager()
