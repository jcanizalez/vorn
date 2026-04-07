import type { WebSocket } from 'ws'
import type { RpcRequest, RequestMethod, RequestMethods } from '@vornrun/shared/protocol'
import { createResponse, createErrorResponse } from '@vornrun/shared/protocol'
import { clientRegistry } from './broadcast'
import log from './logger'

// Handler registry: method name → async handler function
type Handler = (params: unknown) => Promise<unknown> | unknown
const handlers = new Map<string, Handler>()

/**
 * Register a method handler. Called during server startup to wire up
 * manager methods to the WS protocol.
 */
export function registerMethod<M extends RequestMethod>(
  method: M,
  handler: (
    params: RequestMethods[M]['params']
  ) => Promise<RequestMethods[M]['result']> | RequestMethods[M]['result']
): void {
  handlers.set(method, handler as Handler)
}

/**
 * Register a fire-and-forget notification handler (no response sent).
 */
export function registerNotification(method: string, handler: (params: unknown) => void): void {
  handlers.set(`notify:${method}`, handler as Handler)
}

/**
 * Handle a new WebSocket connection. Sets up message parsing,
 * request dispatching, and cleanup on close.
 */
export function handleConnection(ws: WebSocket): void {
  clientRegistry.add(ws)

  ws.on('message', async (raw: Buffer) => {
    let msg: RpcRequest
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      log.warn('[ws] received non-JSON message')
      return
    }

    const { id, method, params } = msg

    // Fire-and-forget notification (no id)
    if (id === undefined || id === null) {
      const notifHandler = handlers.get(`notify:${method}`)
      if (notifHandler) {
        try {
          notifHandler(params)
        } catch (err) {
          log.error({ err, method }, '[ws] notification handler error')
        }
      }
      return
    }

    // Request-response
    const handler = handlers.get(method)
    if (!handler) {
      ws.send(JSON.stringify(createErrorResponse(id, -32601, `Method not found: ${method}`)))
      return
    }

    try {
      const result = await handler(params)
      ws.send(JSON.stringify(createResponse(id, result)))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error({ err, method }, '[ws] handler error')
      ws.send(JSON.stringify(createErrorResponse(id, -32000, message)))
    }
  })

  ws.on('close', () => {
    clientRegistry.remove(ws)
  })

  ws.on('error', (err) => {
    log.error({ err }, '[ws] socket error')
    clientRegistry.remove(ws)
  })
}
