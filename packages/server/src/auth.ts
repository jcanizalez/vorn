import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import log from './logger'

const TOKEN_FILENAME = 'server-token'

function resolveTokenPath(dataDir?: string): string {
  const dir = dataDir ?? path.join(os.homedir(), '.vibegrid')
  return path.join(dir, TOKEN_FILENAME)
}

export function getOrCreateToken(dataDir?: string): string {
  const tokenPath = resolveTokenPath(dataDir)
  try {
    if (fs.existsSync(tokenPath)) {
      const existing = fs.readFileSync(tokenPath, 'utf-8').trim()
      if (existing) return existing
    }
  } catch (err) {
    log.warn({ err }, '[auth] failed to read existing token, generating new one')
  }

  const token = `vg_tk_${crypto.randomUUID()}`
  const dir = path.dirname(tokenPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(tokenPath, token, { encoding: 'utf-8', mode: 0o600 })
  log.info('[auth] generated new server token')
  return token
}

export function regenerateToken(dataDir?: string): string {
  const tokenPath = resolveTokenPath(dataDir)
  const token = `vg_tk_${crypto.randomUUID()}`
  const dir = path.dirname(tokenPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(tokenPath, token, { encoding: 'utf-8', mode: 0o600 })
  log.info('[auth] regenerated server token')
  return token
}

export function validateToken(provided: string, stored: string): boolean {
  const providedBuf = Buffer.from(provided)
  const storedBuf = Buffer.from(stored)
  if (providedBuf.length !== storedBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(providedBuf, storedBuf)
}
