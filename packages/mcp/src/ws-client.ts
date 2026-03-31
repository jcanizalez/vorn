import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { WebSocket } from 'ws'
import type { RpcResponse } from '@vibegrid/shared/protocol'

const PORT_FILE = path.join(os.homedir(), '.vibegrid', 'ws-port')
const TIMEOUT_MS = 10_000

let rpcId = 0

/**
 * Read the VibeGrid server port from the well-known file.
 * Returns null if the app isn't running.
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
    return null
  }
}

/**
 * Send a single JSON-RPC request to the running VibeGrid server over WebSocket.
 * Opens a connection, sends, waits for the response, then closes.
 */
export async function rpcCall<T = unknown>(method: string, params?: unknown): Promise<T> {
  const port = readPort()
  if (!port) {
    throw new Error('VibeGrid app is not running. Start VibeGrid to use session management tools.')
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
    throw new Error('VibeGrid app is not running. Start VibeGrid to use session management tools.')
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
