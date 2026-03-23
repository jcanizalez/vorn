import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { AgentType, RecentSession } from '@vibegrid/shared/types'
import { normalizePath } from './process-utils'

interface AgentHistoryProvider {
  getRecentSessions(projectPath?: string, limit?: number): RecentSession[]
}

// ---------------------------------------------------------------------------
// Shared helper -- run a read-only SQLite query via the system sqlite3 CLI
// ---------------------------------------------------------------------------

function querySqlite(dbPath: string, sql: string): Record<string, unknown>[] {
  try {
    const output = execFileSync('sqlite3', ['-json', '-readonly', dbPath, sql], {
      encoding: 'utf-8' as const,
      stdio: ['pipe', 'pipe', 'pipe'] as const,
      timeout: 5000
    })
    const trimmed = output.trim()
    if (!trimmed) return []
    return JSON.parse(trimmed)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Claude Code  --  ~/.claude/history.jsonl
// ---------------------------------------------------------------------------

interface ClaudeHistoryEntry {
  sessionId: string
  display: string
  project: string
  timestamp: number
}

const claudeProvider: AgentHistoryProvider = {
  getRecentSessions(projectPath?: string, limit = 20): RecentSession[] {
    const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl')

    try {
      if (!fs.existsSync(historyPath)) return []

      const raw = fs.readFileSync(historyPath, 'utf-8')
      const lines = raw.trim().split('\n').filter(Boolean)

      // Normalize once outside the loop to avoid per-line realpathSync syscalls
      const normalizedFilter = projectPath ? normalizePath(projectPath) : undefined

      const sessionMap = new Map<
        string,
        {
          display: string
          projectPath: string
          firstTimestamp: number
          lastTimestamp: number
          count: number
        }
      >()

      for (const line of lines) {
        try {
          const entry: ClaudeHistoryEntry = JSON.parse(line)
          if (!entry.sessionId || !entry.project) continue

          if (normalizedFilter && normalizePath(entry.project) !== normalizedFilter) continue

          const existing = sessionMap.get(entry.sessionId)
          if (existing) {
            existing.lastTimestamp = Math.max(existing.lastTimestamp, entry.timestamp)
            existing.count++
          } else {
            sessionMap.set(entry.sessionId, {
              display: entry.display || '',
              projectPath: entry.project,
              firstTimestamp: entry.timestamp,
              lastTimestamp: entry.timestamp,
              count: 1
            })
          }
        } catch {
          // skip malformed lines
        }
      }

      return Array.from(sessionMap.entries())
        .map(([sessionId, data]) => ({
          sessionId,
          agentType: 'claude' as AgentType,
          display: data.display,
          projectPath: data.projectPath,
          timestamp: data.lastTimestamp,
          messageCount: data.count
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
    } catch {
      return []
    }
  }
}

// ---------------------------------------------------------------------------
// Gemini CLI  --  ~/.gemini/projects.json + ~/.gemini/tmp/*/chats/session-*.json
// ---------------------------------------------------------------------------

interface GeminiSessionFile {
  sessionId: string
  startTime: string
  lastUpdated: string
  messages: { id: string; timestamp: string; type: string; content: string | unknown }[]
}

const geminiProvider: AgentHistoryProvider = {
  getRecentSessions(projectPath?: string, limit = 20): RecentSession[] {
    const geminiDir = path.join(os.homedir(), '.gemini')
    const projectsPath = path.join(geminiDir, 'projects.json')

    try {
      if (!fs.existsSync(projectsPath)) return []

      const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf-8')) as {
        projects: Record<string, string> // path -> name
      }

      // Build reverse map: name -> path
      const nameToPath = new Map<string, string>()
      for (const [projPath, projName] of Object.entries(projectsData.projects)) {
        nameToPath.set(projName, projPath)
      }

      // Determine which projects to scan
      const projectsToScan: [string, string][] = [] // [name, path]
      if (projectPath) {
        const name = projectsData.projects[projectPath]
        if (name) projectsToScan.push([name, projectPath])
        else return []
      } else {
        for (const [name, pPath] of nameToPath) {
          projectsToScan.push([name, pPath])
        }
      }

      const sessions: RecentSession[] = []

      for (const [projName, projPath] of projectsToScan) {
        const chatsDir = path.join(geminiDir, 'tmp', projName, 'chats')
        if (!fs.existsSync(chatsDir)) continue

        const files = fs
          .readdirSync(chatsDir)
          .filter((f) => f.startsWith('session-') && f.endsWith('.json'))
          .map((f) => ({ name: f, mtime: fs.statSync(path.join(chatsDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, limit)

        for (const file of files) {
          try {
            const raw = fs.readFileSync(path.join(chatsDir, file.name), 'utf-8')
            const session: GeminiSessionFile = JSON.parse(raw)

            const userMessages = session.messages.filter((m) => m.type === 'user')
            const firstMsg = userMessages[0]?.content
            const display = typeof firstMsg === 'string' ? firstMsg.slice(0, 80) : ''

            sessions.push({
              sessionId: session.sessionId,
              agentType: 'gemini',
              display,
              projectPath: projPath,
              timestamp: new Date(session.lastUpdated).getTime(),
              messageCount: userMessages.length
            })
          } catch {
            // skip malformed session files
          }
        }
      }

      return sessions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
    } catch {
      return []
    }
  }
}

// ---------------------------------------------------------------------------
// Codex CLI  --  ~/.codex/state_5.sqlite (threads) + ~/.codex/history.jsonl
// ---------------------------------------------------------------------------

const codexProvider: AgentHistoryProvider = {
  getRecentSessions(projectPath?: string, limit = 20): RecentSession[] {
    const dbPath = path.join(os.homedir(), '.codex', 'state_5.sqlite')

    try {
      if (!fs.existsSync(dbPath)) return []

      // Build message count map from history.jsonl
      const msgCounts = new Map<string, number>()
      const historyPath = path.join(os.homedir(), '.codex', 'history.jsonl')
      if (fs.existsSync(historyPath)) {
        const lines = fs.readFileSync(historyPath, 'utf-8').trim().split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as { session_id?: string }
            if (entry.session_id) {
              msgCounts.set(entry.session_id, (msgCounts.get(entry.session_id) || 0) + 1)
            }
          } catch {
            /* skip */
          }
        }
      }

      const where = projectPath
        ? `WHERE archived = 0 AND cwd = '${projectPath.replace(/'/g, "''")}'`
        : 'WHERE archived = 0'

      const sql = `SELECT id, cwd, title, updated_at, first_user_message FROM threads ${where} ORDER BY updated_at DESC LIMIT ${limit}`
      const rows = querySqlite(dbPath, sql)

      return rows.map((row) => ({
        sessionId: String(row.id),
        agentType: 'codex' as AgentType,
        display: String(row.title || row.first_user_message || '').slice(0, 80),
        projectPath: String(row.cwd || ''),
        timestamp: Number(row.updated_at) * 1000,
        messageCount: msgCounts.get(String(row.id)) || 1
      }))
    } catch {
      return []
    }
  }
}

// ---------------------------------------------------------------------------
// GitHub Copilot CLI  --  ~/.copilot/session-store.db (sessions + turns)
// ---------------------------------------------------------------------------

const copilotProvider: AgentHistoryProvider = {
  getRecentSessions(projectPath?: string, limit = 20): RecentSession[] {
    const dbPath = path.join(os.homedir(), '.copilot', 'session-store.db')

    try {
      if (!fs.existsSync(dbPath)) return []

      const where = projectPath ? `WHERE s.cwd = '${projectPath.replace(/'/g, "''")}'` : ''

      const sql = `SELECT s.id, s.cwd, s.summary, s.updated_at, COUNT(t.id) as turn_count FROM sessions s LEFT JOIN turns t ON s.id = t.session_id ${where} GROUP BY s.id ORDER BY s.updated_at DESC LIMIT ${limit}`
      const rows = querySqlite(dbPath, sql)

      return rows.map((row) => ({
        sessionId: String(row.id),
        agentType: 'copilot' as AgentType,
        display: String(row.summary || '').slice(0, 80),
        projectPath: String(row.cwd || ''),
        timestamp: new Date(String(row.updated_at)).getTime(),
        messageCount: Number(row.turn_count) || 0
      }))
    } catch {
      return []
    }
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const providers: AgentHistoryProvider[] = [
  claudeProvider,
  geminiProvider,
  codexProvider,
  copilotProvider
]

export function getRecentSessions(projectPath?: string, limit = 20): RecentSession[] {
  const allSessions: RecentSession[] = []

  for (const provider of providers) {
    allSessions.push(...provider.getRecentSessions(projectPath, limit))
  }

  return allSessions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
}
