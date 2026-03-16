import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { handleConnection, registerMethod } from './ws-handler'
import { registerAllMethods } from './register-methods'
import { configManager } from './config-manager'
import { ptyManager } from './pty-manager'
import { headlessManager } from './headless-manager'
import { scheduler } from './scheduler'
import { setDataDir } from './task-images'
import log from './logger'

export async function startServer(
  options: { host?: string; port?: number; dataDir?: string } = {}
) {
  // Resolve data directory
  const dataDir = options.dataDir ?? path.join(os.homedir(), '.vibegrid')
  setDataDir(dataDir)

  // Initialize database + config
  configManager.init()
  configManager.watchDb()

  // Load initial config and wire up managers
  const config = configManager.loadConfig()
  ptyManager.setAgentCommands(config.agentCommands)
  ptyManager.setRemoteHosts(config.remoteHosts ?? [])
  headlessManager.setAgentCommands(config.agentCommands)
  scheduler.syncSchedules(config.workflows ?? [])

  // Re-sync managers and broadcast to clients when config changes
  const { clientRegistry } = await import('./broadcast')
  const { IPC } = await import('@vibegrid/shared/types')
  configManager.onConfigChanged((cfg) => {
    ptyManager.setAgentCommands(cfg.agentCommands)
    ptyManager.setRemoteHosts(cfg.remoteHosts ?? [])
    headlessManager.setAgentCommands(cfg.agentCommands)
    scheduler.syncSchedules(cfg.workflows ?? [])
    clientRegistry.broadcast(IPC.CONFIG_CHANGED, cfg)
  })

  // Set up Fastify + WebSocket
  const app = Fastify({ logger: false })
  await app.register(websocket)

  app.get('/ws', { websocket: true }, (socket) => {
    handleConnection(socket)
  })

  app.get('/health', async () => ({ status: 'ok' }))

  // Register all RPC methods
  registerAllMethods()

  // Server shutdown method (callable from clients)
  registerMethod('server:shutdown', async () => {
    log.info('[server] shutdown requested via RPC')
    setTimeout(async () => {
      await shutdown()
    }, 100)
  })

  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0 // 0 = OS-assigned

  await app.listen({ host, port })
  const address = app.server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port

  // Write port to stdout for parent process (Electron) to read
  process.stdout.write(JSON.stringify({ port: actualPort }) + '\n')

  // Write WS port to a well-known file so MCP and other tools can discover it
  const wsPortFile = path.join(os.homedir(), '.vibegrid', 'ws-port')
  const wsPortDir = path.dirname(wsPortFile)
  if (!fs.existsSync(wsPortDir)) fs.mkdirSync(wsPortDir, { recursive: true })
  fs.writeFileSync(wsPortFile, String(actualPort), 'utf-8')

  log.info(`[server] listening on ${host}:${actualPort}`)

  // Graceful shutdown
  const { hookServer } = await import('./hook-server')
  const { uninstallHooks } = await import('./hook-installer')
  const { uninstallAllCopilotHooks } = await import('./copilot-hook-installer')
  const { hookStatusMapper } = await import('./hook-status-mapper')
  const { sessionManager } = await import('./session-persistence')

  const shutdown = async () => {
    log.info('[server] shutting down...')
    const sessions = ptyManager.getActiveSessions()
    if (sessions.length > 0) {
      sessionManager.saveSessions(sessions)
    }
    hookServer.stop()
    uninstallHooks()
    uninstallAllCopilotHooks()
    hookStatusMapper.clear()
    scheduler.stopAll()
    headlessManager.killAll()
    ptyManager.killAll()
    configManager.close()
    try {
      fs.unlinkSync(wsPortFile)
    } catch {
      /* ignore */
    }
    await app.close()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  return { app, port: actualPort }
}

// Run directly
const isDirectRun =
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js') ||
  process.argv[1]?.endsWith('index.cjs')
if (isDirectRun) {
  const portArg = process.argv.find((a) => a.startsWith('--port='))
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 0

  const dataDirArg = process.argv.find((a) => a.startsWith('--data-dir='))
  const dataDir = dataDirArg ? dataDirArg.split('=')[1] : undefined

  startServer({ port, dataDir }).catch((err) => {
    log.error({ err }, '[server] failed to start')
    const msg =
      '[server] failed to start: ' + (err instanceof Error ? err.stack || err.message : String(err))
    process.stderr.write(msg + '\n')
    process.exit(1)
  })
}
