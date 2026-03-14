import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import log from '../logger'
import { ServerBridge } from './server-bridge'

let serverProcess: ChildProcess | null = null
let bridge: ServerBridge | null = null

/**
 * Spawns the @vibegrid/server process and returns a connected ServerBridge.
 *
 * The server writes `{"port": N}` to stdout on startup.
 * We read the port, then connect a WebSocket bridge.
 */
export async function launchServer(): Promise<ServerBridge> {
  const serverEntryPoint = resolveServerEntry()
  log.info(`[launcher] starting server: ${serverEntryPoint}`)

  const dataDir = app.getPath('userData')

  const isDev = !!process.env.ELECTRON_RENDERER_URL
  const command = isDev ? 'npx' : process.execPath
  const args = isDev
    ? ['tsx', serverEntryPoint, `--data-dir=${dataDir}`]
    : [serverEntryPoint, `--data-dir=${dataDir}`]

  serverProcess = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? (isDev ? 'development' : 'production')
    },
    cwd: isDev ? path.join(__dirname, '../..') : undefined
  })

  serverProcess.stdin?.end()

  // Forward server stderr to our log
  if (serverProcess.stderr) {
    const errLines = createInterface({ input: serverProcess.stderr })
    errLines.on('line', (line) => {
      log.info(`[server] ${line}`)
    })
  }

  // Read port from server stdout
  const port = await readServerPort(serverProcess)
  log.info(`[launcher] server started on port ${port}`)

  // Connect bridge
  bridge = new ServerBridge(`ws://127.0.0.1:${port}/ws`)
  bridge.connect()

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Bridge connection timeout')), 10_000)
    bridge!.once('connected', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  // Handle server crash
  serverProcess.on('exit', (code, signal) => {
    log.warn(`[launcher] server exited (code=${code}, signal=${signal})`)
    serverProcess = null
  })

  return bridge
}

export function getServerBridge(): ServerBridge | null {
  return bridge
}

export async function stopServer(): Promise<void> {
  if (bridge) {
    try {
      await bridge.request('server:shutdown', undefined, 5000)
    } catch {
      // Server may already be gone
    }
    bridge.close()
    bridge = null
  }

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
    // Force kill after 3 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL')
      }
    }, 3000)
    serverProcess = null
  }
}

function resolveServerEntry(): string {
  // In dev: packages/server/src/index.ts (run via tsx)
  // In production: resources/server/index.js (bundled)
  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev mode — use tsx to run TypeScript directly
    return path.join(__dirname, '../../packages/server/src/index.ts')
  }
  return path.join(process.resourcesPath, 'server', 'index.js')
}

function readServerPort(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!child.stdout) {
      reject(new Error('No stdout on server process'))
      return
    }

    const rl = createInterface({ input: child.stdout })
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for server port'))
    }, 10_000)

    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line)
        if (typeof parsed.port === 'number') {
          clearTimeout(timeout)
          rl.close()
          resolve(parsed.port)
        }
      } catch {
        // Not JSON or not our port line — ignore
      }
    })

    child.on('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Server exited before reporting port (code=${code})`))
    })
  })
}
