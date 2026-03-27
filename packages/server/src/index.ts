import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'

// CJS (prod bundle): __dirname is a global. ESM (dev/tsx): fall back to the
// directory of the entry script. Avoids import.meta.url which tsup emits as
// import_meta.url in the CJS bundle, crashing at runtime.
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(process.argv[1])
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import { handleConnection, registerMethod } from './ws-handler'
import { registerAllMethods, setServerPort } from './register-methods'
import { configManager } from './config-manager'
import { ptyManager } from './pty-manager'
import { headlessManager } from './headless-manager'
import { scheduler } from './scheduler'
import { setDataDir, getTaskImagePath as resolveTaskImagePath } from './task-images'
import { getTailscaleStatus } from './tailscale'
import { initRebind, checkAndRebind } from './server-rebind'
import { getOrCreateToken, validateToken } from './auth'
import { getServerInfo } from './server-identity'
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
    // Auto-rebind when networkAccessEnabled changes
    checkAndRebind().catch((err) => log.warn({ err }, '[server] rebind check failed'))
  })

  // Auth state — computed after host is determined, but closures capture by reference
  let authEnabled = false
  let serverToken: string | null = null

  // Set up Fastify + WebSocket
  const app = Fastify({ logger: false })
  await app.register(websocket)

  app.get('/ws', { websocket: true }, (socket, req) => {
    if (authEnabled && serverToken) {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const token = url.searchParams.get('token')
      if (!token || !validateToken(token, serverToken)) {
        socket.close(4001, 'Unauthorized')
        return
      }
    }
    handleConnection(socket)
  })

  const getServerIdentity = () => getServerInfo(dataDir)
  app.get('/health', async () => {
    const identity = getServerIdentity()
    return { status: 'ok', ...identity }
  })

  // Auth middleware for HTTP routes when non-localhost
  // Uses closure over authEnabled/serverToken which are set after host determination
  app.addHook('onRequest', async (req, reply) => {
    if (!authEnabled || !serverToken) return
    // Skip auth for health endpoint (used for connection testing)
    if (req.url === '/health') return
    // Skip auth for WebSocket (handled at connection level)
    if (req.headers.upgrade === 'websocket') return

    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '')
    if (!token || !validateToken(token, serverToken)) {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  // Serve task images via HTTP (used by web app instead of file:// protocol)
  app.get('/api/task-images/:taskId/:filename', async (req, reply) => {
    const { taskId, filename } = req.params as { taskId: string; filename: string }
    try {
      const filePath = resolveTaskImagePath(taskId, filename)
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: 'Image not found' })
      }
      const ext = path.extname(filename).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp'
      }
      reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream')
      reply.header('Cache-Control', 'public, max-age=86400')
      reply.header('X-Content-Type-Options', 'nosniff')
      const stream = fs.createReadStream(filePath)
      return reply.send(stream)
    } catch {
      return reply.code(400).send({ error: 'Invalid request' })
    }
  })

  // Serve web app static files at /app/ if the dist directory exists.
  // Dev:        _dirname = packages/server/src → ../../web/dist
  // Prod:       _dirname = Resources/server    → ../web/dist
  // Standalone: _dirname = packages/server/dist → ../web-dist
  const webDistCandidates = [
    path.resolve(_dirname, '../web/dist'),
    path.resolve(_dirname, '../../web/dist'),
    path.resolve(_dirname, '../web-dist')
  ]
  const webDistDir = webDistCandidates.find((d) => fs.existsSync(d))
  if (fs.existsSync(webDistDir)) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: '/app/'
    })
    // SPA fallback: serve index.html for any /app/* route not matching a file
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/app')) {
        return reply.sendFile('index.html', webDistDir)
      }
      reply.code(404).send({ error: 'Not found' })
    })
    log.info(`[server] serving web app from ${webDistDir}`)
  }

  // Register all RPC methods
  registerAllMethods()

  // Server shutdown method (callable from clients)
  registerMethod('server:shutdown', async () => {
    log.info('[server] shutdown requested via RPC')
    setTimeout(async () => {
      await shutdown()
    }, 100)
  })

  // Determine bind address: if networkAccessEnabled AND Tailscale is running,
  // bind to 0.0.0.0 so other devices on the tailnet can reach us.
  // Otherwise, localhost only.
  let host = options.host ?? '127.0.0.1'
  if (!options.host && config.defaults.networkAccessEnabled) {
    try {
      const tsStatus = await getTailscaleStatus()
      if (tsStatus.running && tsStatus.selfIP) {
        host = '0.0.0.0'
        log.info(
          `[server] remote access enabled, binding to 0.0.0.0 (tailscale IP: ${tsStatus.selfIP})`
        )
      }
    } catch (err) {
      log.warn({ err }, '[server] failed to check tailscale status, falling back to localhost')
    }
  }

  // Enable auth when binding to non-localhost (remote access)
  authEnabled = host !== '127.0.0.1'
  serverToken = authEnabled ? getOrCreateToken(dataDir) : null
  if (authEnabled) {
    log.info('[server] authentication enabled for non-localhost binding')
  }

  const port = options.port ?? 0 // 0 = OS-assigned

  await app.listen({ host, port })
  const address = app.server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port

  // Store port for RPC methods (e.g. tailscale:status needs it)
  setServerPort(actualPort)

  // Enable hot-rebind when network access / Tailscale state changes
  initRebind(app.server, host, actualPort)

  // Write port to stdout for parent process (Electron) to read
  process.stdout.write(JSON.stringify({ port: actualPort }) + '\n')

  // Write WS port to a well-known file so MCP and other tools can discover it
  const wsPortFile = path.join(os.homedir(), '.vibegrid', 'ws-port')
  try {
    const wsPortDir = path.dirname(wsPortFile)
    if (!fs.existsSync(wsPortDir)) fs.mkdirSync(wsPortDir, { recursive: true })
    fs.writeFileSync(wsPortFile, String(actualPort), 'utf-8')
  } catch (err) {
    log.warn({ err }, '[server] failed to write ws-port file (MCP discovery will not work)')
  }

  log.info(`[server] listening on ${host}:${actualPort}`)

  // Graceful shutdown
  const { hookServer } = await import('./hook-server')
  const { uninstallHooks } = await import('./hook-installer')
  const { uninstallAllCopilotHooks } = await import('./copilot-hook-installer')
  const { hookStatusMapper } = await import('./hook-status-mapper')
  const { sessionManager } = await import('./session-persistence')

  const shutdown = async () => {
    log.info('[server] shutting down...')
    // Stop the periodic timer first, then do one final synchronous save
    sessionManager.stopAutoSave()
    sessionManager.persistNow()
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

  return { app, port: actualPort, token: serverToken }
}

// Run directly
const isDirectRun =
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js') ||
  process.argv[1]?.endsWith('index.cjs')
if (isDirectRun) {
  const portArg = process.argv.find((a) => a.startsWith('--port='))
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 0

  const hostArg = process.argv.find((a) => a.startsWith('--host='))
  const host = hostArg ? hostArg.split('=')[1] : undefined

  const dataDirArg = process.argv.find((a) => a.startsWith('--data-dir='))
  const dataDir = dataDirArg ? dataDirArg.split('=')[1] : undefined

  startServer({ port, host, dataDir }).catch((err) => {
    log.error({ err }, '[server] failed to start')
    const msg =
      '[server] failed to start: ' + (err instanceof Error ? err.stack || err.message : String(err))
    process.stderr.write(msg + '\n')
    process.exit(1)
  })
}
