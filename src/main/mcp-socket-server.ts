import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { app } from 'electron'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'
import { registerTaskTools } from './mcp-tools/tasks'
import { registerProjectTools } from './mcp-tools/projects'
import { registerSessionTools } from './mcp-tools/sessions'
import { registerWorkflowTools } from './mcp-tools/workflows'
import { registerGitTools } from './mcp-tools/git'
import { registerConfigTools } from './mcp-tools/config'
import type { configManager as ConfigManagerInstance } from './config-manager'
import type { ptyManager as PtyManagerInstance } from './pty-manager'
import type { scheduler as SchedulerInstance } from './scheduler'
import log from './logger'

interface McpSocketDeps {
  configManager: typeof ConfigManagerInstance
  ptyManager: typeof PtyManagerInstance
  scheduler: typeof SchedulerInstance
}

const SOCKET_DIR = path.join(os.homedir(), '.vibegrid')

export function getSocketPath(): string {
  const isDev = !app.isPackaged
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\vibegrid-${isDev ? 'dev' : 'prod'}`
  }
  return path.join(SOCKET_DIR, isDev ? 'mcp-dev.sock' : 'mcp.sock')
}

/**
 * Custom MCP Transport that reads/writes over a net.Socket.
 * Structurally identical to StdioServerTransport but for sockets.
 */
class SocketTransport implements Transport {
  private readBuffer = new ReadBuffer()
  private started = false

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  constructor(private socket: net.Socket) {}

  async start(): Promise<void> {
    if (this.started) throw new Error('SocketTransport already started')
    this.started = true

    this.socket.on('data', (chunk: Buffer) => {
      this.readBuffer.append(chunk)
      this.processReadBuffer()
    })

    this.socket.on('error', (err: Error) => {
      this.onerror?.(err)
    })

    this.socket.on('close', () => {
      this.readBuffer.clear()
      this.onclose?.()
    })
  }

  private processReadBuffer(): void {
    while (true) {
      try {
        const message = this.readBuffer.readMessage()
        if (message === null) break
        this.onmessage?.(message)
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.destroyed) {
        reject(new Error('Socket is destroyed'))
        return
      }
      const json = serializeMessage(message)
      if (this.socket.write(json)) {
        resolve()
      } else {
        this.socket.once('drain', resolve)
      }
    })
  }

  async close(): Promise<void> {
    this.readBuffer.clear()
    if (!this.socket.destroyed) {
      this.socket.end()
    }
    this.onclose?.()
  }
}

let server: net.Server | null = null

export function startMcpSocketServer(deps: McpSocketDeps): void {
  const socketPath = getSocketPath()

  // Clean up stale socket from a previous crash (safe — GUI holds singleton lock)
  if (process.platform !== 'win32') {
    try { fs.unlinkSync(socketPath) } catch { /* doesn't exist, fine */ }
  }

  server = net.createServer((socket) => {
    log.info('[mcp-socket] new connection')

    const transport = new SocketTransport(socket)
    const mcpServer = new McpServer(
      { name: 'vibegrid', version: app.getVersion() },
      { capabilities: { tools: {} } }
    )

    registerProjectTools(mcpServer, { configManager: deps.configManager })
    registerTaskTools(mcpServer, { configManager: deps.configManager })
    registerSessionTools(mcpServer, { ptyManager: deps.ptyManager })
    registerWorkflowTools(mcpServer, { configManager: deps.configManager, scheduler: deps.scheduler })
    registerGitTools(mcpServer)
    registerConfigTools(mcpServer, { configManager: deps.configManager })

    mcpServer.connect(transport).catch((err) => {
      log.error('[mcp-socket] connect error:', err)
    })
  })

  server.on('error', (err) => {
    log.error('[mcp-socket] server error:', err)
  })

  server.listen(socketPath, () => {
    if (process.platform !== 'win32') {
      try { fs.chmodSync(socketPath, 0o600) } catch { /* ignore */ }
    }
    log.info(`[mcp-socket] listening on ${socketPath}`)
  })
}

export function stopMcpSocketServer(): void {
  if (server) {
    server.close()
    server = null
  }
  if (process.platform !== 'win32') {
    const socketPath = getSocketPath()
    try { fs.unlinkSync(socketPath) } catch { /* ignore */ }
  }
}
