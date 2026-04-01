import { execFile } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import log from './logger'

export interface AgentUsageData {
  agentType: 'claude' | 'codex'
  session?: { utilization: number; resetsAt: string }
  weekly?: { utilization: number; resetsAt: string }
  extraUsage?: { used: number; limit: number; currency: string }
  lastUpdated: number
  error?: string
}

// ── Cache ──
const cache = new Map<string, AgentUsageData>()
let lastFetchTime = 0
const CACHE_TTL = 30_000 // 30 seconds

// ── Public API ──

export async function getAllAgentUsage(): Promise<AgentUsageData[]> {
  const now = Date.now()
  if (now - lastFetchTime < CACHE_TTL && cache.size > 0) {
    return Array.from(cache.values())
  }

  const results = await Promise.allSettled([fetchClaudeUsage(), fetchCodexUsage()])
  const data: AgentUsageData[] = []

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      cache.set(r.value.agentType, r.value)
      data.push(r.value)
    }
  }

  lastFetchTime = now
  return data.length > 0 ? data : Array.from(cache.values())
}

// ── Claude Usage ──

async function fetchClaudeUsage(): Promise<AgentUsageData | null> {
  try {
    const token = await getClaudeOAuthToken()
    if (!token) {
      return { agentType: 'claude', lastUpdated: Date.now(), error: 'No OAuth token found' }
    }

    // Check if token is expired and refresh if needed
    const activeToken = await ensureValidClaudeToken(token)
    if (!activeToken) {
      return { agentType: 'claude', lastUpdated: Date.now(), error: 'Token expired' }
    }

    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${activeToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'vibegrid/1.0'
      }
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      log.warn(`[agent-usage] Claude API ${res.status}: ${text.slice(0, 200)}`)
      return { agentType: 'claude', lastUpdated: Date.now(), error: `API error ${res.status}` }
    }

    const body = (await res.json()) as Record<string, unknown>

    const fiveHour = body.five_hour as { utilization?: number; resets_at?: string } | undefined
    const sevenDay = body.seven_day as { utilization?: number; resets_at?: string } | undefined
    const extra = body.extra_usage as
      | {
          is_enabled?: boolean
          used_credits?: number
          monthly_limit?: number
          currency?: string
        }
      | undefined

    const data: AgentUsageData = {
      agentType: 'claude',
      lastUpdated: Date.now()
    }

    // API may return utilization as 0-1 fraction OR 0-100 percentage — normalize to 0-1
    const normalize = (v: number) => (v > 1 ? v / 100 : v)

    if (fiveHour?.utilization != null) {
      data.session = {
        utilization: normalize(fiveHour.utilization),
        resetsAt: fiveHour.resets_at ?? ''
      }
    }

    if (sevenDay?.utilization != null) {
      data.weekly = {
        utilization: normalize(sevenDay.utilization),
        resetsAt: sevenDay.resets_at ?? ''
      }
    }

    if (extra?.is_enabled && extra.used_credits != null && extra.monthly_limit != null) {
      data.extraUsage = {
        used: extra.used_credits,
        limit: extra.monthly_limit,
        currency: extra.currency ?? 'USD'
      }
    }

    return data
  } catch (err) {
    log.warn('[agent-usage] Claude fetch error:', err)
    return { agentType: 'claude', lastUpdated: Date.now(), error: String(err) }
  }
}

interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
}

let cachedCredentials: ClaudeCredentials | null = null

async function getClaudeOAuthToken(): Promise<string | null> {
  try {
    // Try macOS Keychain first
    if (process.platform === 'darwin') {
      const raw = await execPromise('security', [
        'find-generic-password',
        '-s',
        'Claude Code-credentials',
        '-w'
      ])
      if (raw) {
        const parsed = JSON.parse(raw.trim()) as ClaudeCredentials
        cachedCredentials = parsed
        return parsed.claudeAiOauth?.accessToken ?? null
      }
    }

    // Fallback: try file-based credentials
    const credPath = join(homedir(), '.claude', '.credentials.json')
    const content = await readFile(credPath, 'utf-8').catch(() => null)
    if (content) {
      const parsed = JSON.parse(content) as ClaudeCredentials
      cachedCredentials = parsed
      return parsed.claudeAiOauth?.accessToken ?? null
    }

    return null
  } catch {
    return null
  }
}

async function ensureValidClaudeToken(token: string): Promise<string | null> {
  if (!cachedCredentials?.claudeAiOauth) return token

  const { expiresAt, refreshToken } = cachedCredentials.claudeAiOauth
  if (!expiresAt || Date.now() < expiresAt - 60_000) {
    return token // still valid (with 1min buffer)
  }

  if (!refreshToken) return null

  // Refresh the token
  try {
    const res = await fetch('https://platform.claude.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
      })
    })

    if (!res.ok) return null

    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

// ── Codex Usage ──

async function fetchCodexUsage(): Promise<AgentUsageData | null> {
  try {
    const codexHome = process.env.CODEX_HOME ?? join(homedir(), '.codex')

    // Try reading rate limits from today's session JSONL files
    const now = new Date()
    const dateDir = join(
      codexHome,
      'sessions',
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    )

    let primaryUsed: number | undefined
    let secondaryUsed: number | undefined
    let primaryResetsAt: string | undefined
    let secondaryResetsAt: string | undefined

    try {
      const files = await readdir(dateDir)
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl')).slice(-10) // last 10 files

      for (const file of jsonlFiles.reverse()) {
        if (primaryUsed != null) break // already found rate limits

        const content = await readFile(join(dateDir, file), 'utf-8').catch(() => '')
        const lines = content.split('\n').filter(Boolean).reverse()

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as Record<string, unknown>
            const payload = event.payload as Record<string, unknown> | undefined
            if (!payload) continue

            const rateLimits = payload.rate_limits as Record<string, unknown> | undefined
            if (rateLimits) {
              const primary = rateLimits.primary as
                | {
                    used_percent?: number
                    resets_at?: number | string
                  }
                | undefined
              const secondary = rateLimits.secondary as
                | {
                    used_percent?: number
                    resets_at?: number | string
                  }
                | undefined

              if (primary?.used_percent != null) {
                primaryUsed = primary.used_percent
                if (primary.resets_at) {
                  primaryResetsAt =
                    typeof primary.resets_at === 'number'
                      ? new Date(primary.resets_at * 1000).toISOString()
                      : String(primary.resets_at)
                }
              }
              if (secondary?.used_percent != null) {
                secondaryUsed = secondary.used_percent
                if (secondary.resets_at) {
                  secondaryResetsAt =
                    typeof secondary.resets_at === 'number'
                      ? new Date(secondary.resets_at * 1000).toISOString()
                      : String(secondary.resets_at)
                }
              }
              break
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch {
      // sessions directory may not exist
    }

    if (primaryUsed == null && secondaryUsed == null) {
      // Check if codex is even installed
      try {
        await stat(codexHome)
        return {
          agentType: 'codex',
          lastUpdated: Date.now(),
          error: 'No recent session data'
        }
      } catch {
        return null // codex not installed
      }
    }

    const data: AgentUsageData = {
      agentType: 'codex',
      lastUpdated: Date.now()
    }

    if (primaryUsed != null) {
      data.session = {
        utilization: primaryUsed / 100,
        resetsAt: primaryResetsAt ?? ''
      }
    }

    if (secondaryUsed != null) {
      data.weekly = {
        utilization: secondaryUsed / 100,
        resetsAt: secondaryResetsAt ?? ''
      }
    }

    return data
  } catch (err) {
    log.warn('[agent-usage] Codex fetch error:', err)
    return { agentType: 'codex', lastUpdated: Date.now(), error: String(err) }
  }
}

// ── Utility ──

function execPromise(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout)
    })
  })
}
