import type { Server } from 'node:http'
import { getTailscaleStatus } from './tailscale'
import { configManager } from './config-manager'
import log from './logger'

let httpServer: Server | null = null
let currentHost = '127.0.0.1'
let boundPort = 0
let rebindInFlight: Promise<void> | null = null

export function initRebind(server: Server, host: string, port: number): void {
  httpServer = server
  currentHost = host
  boundPort = port
}

export function getCurrentHost(): string {
  return currentHost
}

/**
 * Check if the server needs to rebind based on current config + Tailscale state.
 * Binds to 0.0.0.0 when networkAccessEnabled AND Tailscale is running, else 127.0.0.1.
 */
export async function checkAndRebind(): Promise<void> {
  // Serialize: if a rebind is already running, just wait for it
  if (rebindInFlight) {
    await rebindInFlight
    return
  }

  rebindInFlight = doRebind()
  try {
    await rebindInFlight
  } finally {
    rebindInFlight = null
  }
}

async function doRebind(): Promise<void> {
  if (!httpServer) return

  const config = configManager.loadConfig()
  let desiredHost = '127.0.0.1'

  if (config.defaults.networkAccessEnabled) {
    try {
      const tsStatus = await getTailscaleStatus()
      if (tsStatus.running) {
        desiredHost = '0.0.0.0'
      }
    } catch {
      // Tailscale check failed, stay on localhost
    }
  }

  if (desiredHost === currentHost) return

  log.info(`[server] rebinding from ${currentHost} to ${desiredHost}:${boundPort}`)

  try {
    const server = httpServer
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections()
    }
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await new Promise<void>((resolve, reject) => {
      const onError = (err: unknown) => {
        server.removeListener('listening', onListening)
        reject(err)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        resolve()
      }
      server.once('error', onError)
      server.listen(boundPort, desiredHost, onListening)
    })
    currentHost = desiredHost
    log.info(`[server] rebound successfully to ${desiredHost}:${boundPort}`)
  } catch (err) {
    log.error({ err }, '[server] rebind failed')
  }
}
