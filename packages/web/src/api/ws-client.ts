import type { RpcResponse, RpcNotification } from '@vibegrid/shared/protocol'
import { createRequest, createNotification } from '@vibegrid/shared/protocol'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  method: string
}

type EventCallback = (...args: unknown[]) => void

/**
 * Browser-native WebSocket JSON-RPC client.
 *
 * Mirrors the desktop ServerBridge pattern but uses the browser WebSocket API
 * instead of the `ws` npm package.
 *
 * - `request(method, params)` sends a JSON-RPC request and returns a Promise.
 * - `notify(method, params)` sends a fire-and-forget notification.
 * - `subscribe(event, cb)` / `unsubscribe(event, cb)` for server push notifications.
 * - Auto-reconnects on disconnect.
 * - Emits lifecycle events: 'connected', 'disconnected'.
 */
export class WsClient {
  private ws: WebSocket | null = null
  private nextId = 0
  private pending = new Map<number, PendingRequest>()
  private listeners = new Map<string, Set<EventCallback>>()
  private url: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true
  private _connected = false

  constructor(url: string) {
    this.url = url
  }

  get connected(): boolean {
    return this._connected
  }

  connect(): void {
    if (this.ws) return

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this._connected = true
      this.emit('connected')
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string)
        if ('id' in msg && msg.id !== undefined) {
          this.handleResponse(msg as RpcResponse)
        } else if ('method' in msg) {
          const notification = msg as RpcNotification
          this.emit('server-notification', notification.method, notification.params)
          // Also emit the specific method name for fine-grained subscriptions
          this.emit(notification.method, notification.params)
        }
      } catch {
        // failed to parse server message
      }
    }

    this.ws.onclose = () => {
      this._connected = false
      this.ws = null
      this.rejectAllPending('Server disconnected')
      this.emit('disconnected')
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // error will trigger onclose
    }
  }

  async request<T = unknown>(method: string, params?: unknown, timeoutMs = 30_000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send request: not connected (method=${method})`)
    }

    const id = ++this.nextId
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Request timed out: ${method} (id=${id})`))
      }, timeoutMs)

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timeout,
        method
      })

      this.ws!.send(JSON.stringify(createRequest(id, method as never, params as never)))
    })
  }

  notify(method: string, params?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }
    this.ws.send(JSON.stringify(createNotification(method, params)))
  }

  subscribe(event: string, callback: EventCallback): void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(callback)
  }

  unsubscribe(event: string, callback: EventCallback): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(callback)
      if (set.size === 0) this.listeners.delete(event)
    }
  }

  close(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.rejectAllPending('Client closing')
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this._connected = false
  }

  // ── Private ──────────────────────────────────────────────────

  private emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const cb of set) {
      try {
        cb(...args)
      } catch {
        // listener error
      }
    }
  }

  private handleResponse(msg: RpcResponse): void {
    const id = typeof msg.id === 'number' ? msg.id : parseInt(String(msg.id), 10)
    const pending = this.pending.get(id)
    if (!pending) return

    this.pending.delete(id)
    clearTimeout(pending.timeout)

    if (msg.error) {
      pending.reject(new Error(msg.error.message))
    } else {
      pending.resolve(msg.result)
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(`${reason} (method=${pending.method}, id=${id})`))
    }
    this.pending.clear()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 2000)
  }
}
