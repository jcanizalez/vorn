import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

const SERVER_ID_FILENAME = 'server-id'

export interface ServerInfo {
  serverId: string
  label: string
  version: string
  host?: string
  port?: number
  uptime: number
}

let startedAt: number | null = null

function resolveIdPath(dataDir?: string): string {
  const dir = dataDir ?? path.join(os.homedir(), '.vibegrid')
  return path.join(dir, SERVER_ID_FILENAME)
}

export function getOrCreateServerId(dataDir?: string): string {
  const idPath = resolveIdPath(dataDir)
  try {
    if (fs.existsSync(idPath)) {
      const existing = fs.readFileSync(idPath, 'utf-8').trim()
      if (existing) return existing
    }
  } catch {
    // Fall through to create
  }

  const id = crypto.randomUUID()
  const dir = path.dirname(idPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(idPath, id, 'utf-8')
  return id
}

function getVersion(): string {
  try {
    // Try production path first (Resources/server → ../package.json)
    // Then dev path (packages/server/src → ../../../package.json)
    const candidates = [
      path.resolve(__dirname, '../package.json'),
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../../../package.json')
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
        if (pkg.version) return pkg.version
      }
    }
  } catch {
    // ignore
  }
  return 'unknown'
}

export function getServerInfo(dataDir?: string): ServerInfo {
  if (startedAt === null) {
    startedAt = Date.now()
  }
  return {
    serverId: getOrCreateServerId(dataDir),
    label: os.hostname(),
    version: getVersion(),
    uptime: Math.floor((Date.now() - startedAt) / 1000)
  }
}
