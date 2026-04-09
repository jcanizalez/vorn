import Database from 'libsql'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { AgentType } from '@vornrun/shared/types'
import log from './logger'

function getAgentDbPath(agentType: AgentType): string | undefined {
  switch (agentType) {
    case 'copilot':
      return path.join(os.homedir(), '.copilot', 'session-store.db')
    case 'codex':
      return path.join(os.homedir(), '.codex', 'state_5.sqlite')
    case 'opencode': {
      const baseDir =
        process.platform === 'win32'
          ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
          : process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')
      return path.join(baseDir, 'opencode', 'opencode.db')
    }
    default:
      return undefined
  }
}

/** Normalize a cwd for comparison: lowercase, forward slashes, no trailing slash.
 *  Matches the SQL normalization: rtrim(lower(replace(col, '\\', '/')), '/'). */
function normalizeCwd(cwd: string): string {
  const normalized = cwd.replace(/\\/g, '/').toLowerCase()
  // rtrim '/' but preserve root '/' to match SQL rtrim behavior
  return normalized === '/' ? '/' : normalized.replace(/\/+$/, '')
}

/**
 * Read the agent CLI's own database to find the most recent session matching
 * the given cwd. Returns the agent's real session ID, or undefined.
 *
 * Uses libsql in read-only mode — no sqlite3 CLI dependency, works on Windows.
 * Pass dbPathOverride for testing to avoid hitting the user's real agent DBs.
 */
export function captureAgentSessionId(
  agentType: AgentType,
  cwd: string,
  dbPathOverride?: string
): string | undefined {
  const dbPath = dbPathOverride ?? getAgentDbPath(agentType)
  if (!dbPath || !fs.existsSync(dbPath)) return undefined

  const normalized = normalizeCwd(cwd)
  let db: InstanceType<typeof Database> | undefined

  try {
    db = new Database(dbPath, { readonly: true })

    let row: { id: string } | undefined

    switch (agentType) {
      case 'copilot':
        row = db
          .prepare(
            `SELECT id FROM sessions
             WHERE rtrim(lower(replace(cwd, '\\', '/')), '/') = ?
             ORDER BY updated_at DESC LIMIT 1`
          )
          .get(normalized) as typeof row
        break

      case 'codex':
        row = db
          .prepare(
            `SELECT id FROM threads
             WHERE archived = 0
               AND rtrim(lower(replace(cwd, '\\', '/')), '/') = ?
             ORDER BY updated_at DESC LIMIT 1`
          )
          .get(normalized) as typeof row
        break

      case 'opencode':
        row = db
          .prepare(
            `SELECT id FROM session
             WHERE time_archived IS NULL
               AND rtrim(lower(replace(directory, '\\', '/')), '/') = ?
             ORDER BY time_updated DESC LIMIT 1`
          )
          .get(normalized) as typeof row
        break
    }

    return row?.id
  } catch (err) {
    log.warn({ err }, `[session-capture] failed to read ${agentType} DB at ${dbPath}`)
    return undefined
  } finally {
    try {
      db?.close()
    } catch {
      /* ignore close errors */
    }
  }
}
