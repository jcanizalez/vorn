import type { WebSocket } from 'ws'
import { createNotification } from '@vornrun/shared/protocol'
import log from './logger'

export class ClientRegistry {
  private clients = new Set<WebSocket>()

  add(ws: WebSocket): void {
    this.clients.add(ws)
    log.info(`[ws] client connected (total: ${this.clients.size})`)
  }

  remove(ws: WebSocket): void {
    this.clients.delete(ws)
    log.info(`[ws] client disconnected (total: ${this.clients.size})`)
  }

  broadcast(method: string, params: unknown): void {
    const msg = JSON.stringify(createNotification(method, params))
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg)
      }
    }
  }

  get size(): number {
    return this.clients.size
  }
}

export const clientRegistry = new ClientRegistry()
