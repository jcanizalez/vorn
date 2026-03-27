#!/usr/bin/env node
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { getOrCreateToken, regenerateToken } from './auth'

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.vibegrid')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: Record<string, string | boolean> = {}
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true
    } else if (arg === '--show-token') {
      opts.showToken = true
    } else if (arg === '--regenerate-token') {
      opts.regenerateToken = true
    } else if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=')
      opts[key] = val ?? true
    }
  }
  return opts
}

function getVersion(): string {
  const candidates = [
    path.resolve(__dirname, '../package.json'),
    path.resolve(__dirname, '../../package.json'),
    path.resolve(__dirname, '../../../package.json')
  ]
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf-8'))
        if (pkg.version) return pkg.version
      }
    } catch {
      // ignore
    }
  }
  return 'unknown'
}

function printUsage() {
  console.log(`
  vibegrid-server — Standalone VibeGrid server with web UI

  Usage:
    vibegrid-server [options]

  Options:
    --host=ADDR           Bind address (default: 127.0.0.1)
    --port=PORT           Bind port (default: auto-assigned)
    --data-dir=PATH       Data directory (default: ~/.vibegrid)
    --show-token          Print the auth token and exit
    --regenerate-token    Generate a new auth token and exit
    --help, -h            Show this help
`)
}

async function main() {
  const opts = parseArgs()
  const dataDir = (opts['data-dir'] as string) || DEFAULT_DATA_DIR

  if (opts.help) {
    printUsage()
    process.exit(0)
  }

  if (opts.showToken) {
    const token = getOrCreateToken(dataDir)
    console.log(token)
    process.exit(0)
  }

  if (opts.regenerateToken) {
    const token = regenerateToken(dataDir)
    console.log(`New token: ${token}`)
    process.exit(0)
  }

  const host = (opts.host as string) || undefined
  const port = opts.port ? parseInt(opts.port as string, 10) : undefined
  const version = getVersion()

  const { startServer } = await import('./index')
  const result = await startServer({ host, port, dataDir })

  const displayHost =
    host === '0.0.0.0' || result.app.server.address()?.toString().includes('0.0.0.0')
      ? os.hostname()
      : 'localhost'
  const displayPort = result.port

  console.log(`
  VibeGrid Server v${version}
  ────────────────────────────────────
  Web UI:     http://${displayHost}:${displayPort}/app/
  WebSocket:  ws://${displayHost}:${displayPort}/ws${result.token ? `\n  Auth Token: ${result.token}` : ''}
  ────────────────────────────────────
  Open the Web UI to set up projects, or connect
  from the VibeGrid desktop app${result.token ? ' using the token above' : ''}.
`)
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
