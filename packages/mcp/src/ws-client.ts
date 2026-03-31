import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { WebSocket } from 'ws'
import type { RpcResponse } from '@vibegrid/shared/protocol'

const PORT_FILE = path.join(os.homedir(), '.vibegrid', 'ws-port')
const TIMEOUT_MS = 10_000

const IS_WIN = process.platform === 'win32'

const PORT_FILE_MISSING_MSG = IS_WIN
  ? `VibeGrid port file not found (~/.vibegrid/ws-port).
The app may be running but the port file was deleted (e.g. by another instance shutting down).
To fix, find the VibeGrid process and its listening port:
  powershell -c "Get-NetTCPConnection -State Listen -OwningProcess (Get-Process VibeGrid).Id | Select LocalPort"
Then write the WS port to the file:
  echo {"port":<PORT>,"pid":<PID>} > %USERPROFILE%\\.vibegrid\\ws-port
Or restart VibeGrid to regenerate it.`
  : `VibeGrid port file not found (~/.vibegrid/ws-port).
The app may be running but the port file was deleted (e.g. by another instance shutting down).
To fix, run:  lsof -iTCP -sTCP:LISTEN -P | grep VibeGrid
Then write the WS port (the one on *:<port>) to the file:
  echo '{"port":<PORT>,"pid":<PID>}' > ~/.vibegrid/ws-port
Or restart VibeGrid to regenerate it.`

let rpcId = 0

// Cache discovered port to avoid repeated execFileSync calls
let cachedPort: number | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5_000

const EXEC_OPTS = {
  encoding: 'utf-8' as const,
  timeout: 5000,
  stdio: ['pipe', 'pipe', 'pipe'] as const
}

/**
 * Try to discover the VibeGrid WS port by querying the OS for listening sockets.
 * Returns the port number if found, null otherwise.
 */
function discoverPort(): number | null {
  try {
    if (IS_WIN) {
      const taskOut = execFileSync(
        'tasklist',
        ['/FI', 'IMAGENAME eq VibeGrid.exe', '/FO', 'CSV', '/NH'],
        EXEC_OPTS
      )
      const pidMatch = taskOut.match(/"VibeGrid\.exe","(\d+)"/)
      if (!pidMatch) return null
      const pid = pidMatch[1]

      const lines = execFileSync('netstat', ['-ano'], EXEC_OPTS).split('\n')
      let fallback: number | null = null
      for (const line of lines) {
        if (!line.includes('LISTENING') || !line.trim().endsWith(pid)) continue
        const m = line.match(/(?:0\.0\.0\.0|127\.0\.0\.1):(\d+)/)
        if (!m) continue
        if (line.includes('0.0.0.0')) return parseInt(m[1], 10)
        fallback ??= parseInt(m[1], 10)
      }
      return fallback
    } else {
      const lines = execFileSync('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n'], EXEC_OPTS).split(
        '\n'
      )
      let fallback: number | null = null
      for (const line of lines) {
        if (!line.includes('VibeGrid')) continue
        if (line.includes('*:')) {
          const m = line.match(/\*:(\d+)/)
          if (m) return parseInt(m[1], 10)
        }
        if (!fallback) {
          const m = line.match(/:(\d+)\s/)
          if (m) fallback = parseInt(m[1], 10)
        }
      }
      return fallback
    }
  } catch {
    // Command failed or not available
  }
  return null
}

/**
 * Read the VibeGrid server port from the well-known file.
 * Falls back to OS-level port discovery if the file is missing.
 */
function readPort(): number | null {
  try {
    const raw = fs.readFileSync(PORT_FILE, 'utf-8').trim()
    if (!raw) return null

    // JSON format: { "port": 53829, "pid": 1234 }
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw)
      const port = parsed?.port
      return typeof port === 'number' && Number.isFinite(port) && port > 0 ? port : null
    }

    // Legacy plain-number format: 53829
    const port = parseInt(raw, 10)
    return Number.isFinite(port) && port > 0 ? port : null
  } catch {
    // Port file missing — return cached discovery if fresh
    const now = Date.now()
    if (cachedPort && now - cacheTimestamp < CACHE_TTL_MS) return cachedPort

    const discovered = discoverPort()
    cachedPort = discovered
    cacheTimestamp = now
    if (discovered) {
      // Self-heal: write the port file so subsequent calls skip discovery
      try {
        fs.mkdirSync(path.dirname(PORT_FILE), { recursive: true })
        fs.writeFileSync(PORT_FILE, JSON.stringify({ port: discovered }), 'utf-8')
      } catch {
        // best-effort
      }
    }
    return discovered
  }
}

/**
 * Send a single JSON-RPC request to the running VibeGrid server over WebSocket.
 * Opens a connection, sends, waits for the response, then closes.
 */
export async function rpcCall<T = unknown>(method: string, params?: unknown): Promise<T> {
  const port = readPort()
  if (!port) {
    throw new Error(PORT_FILE_MISSING_MSG)
  }

  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const id = ++rpcId

    const timer = setTimeout(() => {
      ws.close()
      reject(new Error(`RPC call "${method}" timed out after ${TIMEOUT_MS}ms`))
    }, TIMEOUT_MS)

    ws.on('open', () => {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })

    ws.on('message', (raw: Buffer) => {
      try {
        const msg: RpcResponse = JSON.parse(raw.toString())
        if (msg.id !== id) return // ignore broadcasts / notifications
        clearTimeout(timer)
        ws.close()
        if (msg.error) {
          reject(new Error(msg.error.message))
        } else {
          resolve(msg.result as T)
        }
      } catch {
        // ignore non-JSON messages
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Cannot connect to VibeGrid server: ${err.message}. Is the app running?`))
    })
  })
}

/**
 * Send a fire-and-forget JSON-RPC notification (no response expected).
 */
export async function rpcNotify(method: string, params?: unknown): Promise<void> {
  const port = readPort()
  if (!port) {
    throw new Error(PORT_FILE_MISSING_MSG)
  }

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)

    ws.on('open', () => {
      // No id = fire-and-forget notification per JSON-RPC spec
      ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }))
      ws.close()
      resolve()
    })

    ws.on('error', (err) => {
      reject(new Error(`Cannot connect to VibeGrid server: ${err.message}. Is the app running?`))
    })
  })
}

/**
 * Check whether the VibeGrid server is reachable.
 */
export function isServerRunning(): boolean {
  return readPort() !== null
}
