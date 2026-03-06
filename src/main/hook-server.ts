import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { HookEvent } from '../shared/types'

const PORT_FILE = path.join(os.homedir(), '.vibegrid', 'port')

export interface PendingPermission {
  requestId: string
  res: http.ServerResponse
  event: HookEvent
  createdAt: number
}

export class HookServer extends EventEmitter {
  private server: http.Server | null = null
  private pendingPermissions = new Map<string, PendingPermission>()
  private port = 0

  getPort(): number {
    return this.port
  }

  // Try a fixed preferred port first so settings.json stays stable across
  // restarts (Claude sessions read the URL once and keep using it).
  // Falls back to an OS-assigned port if the preferred one is taken.
  private static readonly PREFERRED_PORT = 56432

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(404)
          res.end()
          return
        }

        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const event = JSON.parse(body) as HookEvent
            this.handleEvent(event, res)
          } catch {
            res.writeHead(400)
            res.end()
          }
        })
      })

      const tryListen = (port: number): void => {
        this.server!.listen(port, '127.0.0.1', () => {
          const addr = this.server!.address()
          if (typeof addr === 'object' && addr) {
            this.port = addr.port
            this.writePortFile()
            resolve(this.port)
          } else {
            reject(new Error('Failed to get server address'))
          }
        })
      }

      this.server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Preferred port taken — fall back to OS-assigned
          console.log(`[hooks] port ${HookServer.PREFERRED_PORT} in use, falling back to random port`)
          this.server!.removeAllListeners('error')
          this.server!.on('error', reject)
          tryListen(0)
        } else {
          reject(err)
        }
      })

      tryListen(HookServer.PREFERRED_PORT)
    })
  }

  private handleEvent(event: HookEvent, res: http.ServerResponse): void {
    if (event.hook_event_name === 'PermissionRequest') {
      const requestId = crypto.randomUUID()
      const pending: PendingPermission = { requestId, res, event, createdAt: Date.now() }
      this.pendingPermissions.set(requestId, pending)
      console.log(`[hooks] permission stored: requestId=${requestId} tool=${event.tool_name} pending=${this.pendingPermissions.size}`)

      // Clean up if connection closes before we respond (e.g. Claude timeout)
      res.on('close', () => {
        if (this.pendingPermissions.has(requestId)) {
          console.log(`[hooks] permission connection closed before response: requestId=${requestId} (Claude may have timed out)`)
          this.pendingPermissions.delete(requestId)
          this.emit('permission-cancelled', requestId)
        }
      })

      this.emit('permission-request', { requestId, event })
    } else {
      // Fire-and-forget: respond immediately
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{}')
      this.emit('hook-event', event)
    }
  }

  /** Immediately release a request with no decision — Claude uses its own default handling */
  passthroughPermission(requestId: string): void {
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) return
    this.pendingPermissions.delete(requestId)
    const { res } = pending
    if (res.writableEnded) return
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  }

  resolvePermission(requestId: string, allow: boolean, extra?: { updatedPermissions?: unknown[]; updatedInput?: unknown }): void {
    console.log(`[hooks] resolvePermission: requestId=${requestId} allow=${allow} pending=${this.pendingPermissions.size} found=${this.pendingPermissions.has(requestId)}`)
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) {
      console.log(`[hooks] resolvePermission: requestId not found in pending map`)
      return
    }

    this.pendingPermissions.delete(requestId)
    const { res } = pending

    if (res.writableEnded) return

    const decision: Record<string, unknown> = { behavior: allow ? 'allow' : 'deny' }
    if (allow && extra?.updatedPermissions?.length) {
      decision.updatedPermissions = extra.updatedPermissions
    }
    if (allow && extra?.updatedInput) {
      decision.updatedInput = extra.updatedInput
    }

    const body = JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision
      }
    })

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    })
    res.end(body)
  }

  getPendingPermissions(): PendingPermission[] {
    return Array.from(this.pendingPermissions.values())
  }

  cancelSessionPermissions(sessionId: string): void {
    for (const [requestId, pending] of this.pendingPermissions) {
      if (pending.event.session_id === sessionId) {
        this.pendingPermissions.delete(requestId)
        console.log(`[hooks] cancelling stale permission for session ${sessionId}: requestId=${requestId}`)
        if (!pending.res.destroyed) {
          pending.res.destroy()
        }
        this.emit('permission-cancelled', requestId)
      }
    }
  }

  private writePortFile(): void {
    const dir = path.dirname(PORT_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(PORT_FILE, String(this.port), 'utf-8')
  }

  stop(): void {
    // Deny all pending permissions
    for (const [id] of this.pendingPermissions) {
      this.resolvePermission(id, false)
    }

    this.server?.close()
    this.server = null

    try {
      if (fs.existsSync(PORT_FILE)) {
        fs.unlinkSync(PORT_FILE)
      }
    } catch { /* ignore */ }
  }
}

export const hookServer = new HookServer()
