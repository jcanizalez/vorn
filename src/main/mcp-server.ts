import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerTaskTools } from './mcp-tools/tasks'
import { registerProjectTools } from './mcp-tools/projects'
import { registerSessionTools } from './mcp-tools/sessions'
import { registerWorkflowTools } from './mcp-tools/workflows'
import { registerGitTools } from './mcp-tools/git'
import { registerConfigTools } from './mcp-tools/config'
import type { configManager as ConfigManagerInstance } from './config-manager'
import type { ptyManager as PtyManagerInstance } from './pty-manager'
import type { scheduler as SchedulerInstance } from './scheduler'

type ConfigManager = typeof ConfigManagerInstance
type PtyManager = typeof PtyManagerInstance
type Scheduler = typeof SchedulerInstance

const PORT_FILE = path.join(os.homedir(), '.vibegrid', 'mcp-port')
const PREFERRED_PORT = 56433

interface McpServerDeps {
  configManager: ConfigManager
  ptyManager: PtyManager
  scheduler: Scheduler
}

export class VibeGridMcpServer {
  private httpServer: http.Server | null = null
  private port = 0
  private deps: McpServerDeps

  constructor(deps: McpServerDeps) {
    this.deps = deps
  }

  /** Create a fresh McpServer with all tools registered (needed per-request for stateless HTTP) */
  private createMcpServer(): McpServer {
    const server = new McpServer(
      { name: 'vibegrid', version: '0.3.1' },
      { capabilities: { tools: {} } }
    )
    const { configManager, ptyManager, scheduler } = this.deps
    registerProjectTools(server, { configManager })
    registerTaskTools(server, { configManager })
    registerSessionTools(server, { ptyManager })
    registerWorkflowTools(server, { configManager, scheduler })
    registerGitTools(server)
    registerConfigTools(server, { configManager })
    return server
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(async (req, res) => {
        // Only accept requests from localhost
        const origin = req.headers.origin
        if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        const url = new URL(req.url ?? '/', `http://127.0.0.1:${this.port}`)

        if (url.pathname !== '/mcp') {
          res.writeHead(404)
          res.end('Not Found')
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk })
          req.on('end', async () => {
            try {
              const server = this.createMcpServer()
              const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
              res.on('close', () => { transport.close() })
              await server.connect(transport)
              await transport.handleRequest(req, res, JSON.parse(body))
            } catch (err) {
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Internal server error' }))
              }
              console.error('[mcp] request error:', err)
            }
          })
        } else if (req.method === 'GET') {
          try {
            const server = this.createMcpServer()
            const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
            res.on('close', () => { transport.close() })
            await server.connect(transport)
            await transport.handleRequest(req, res)
          } catch (err) {
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Internal server error' }))
            }
            console.error('[mcp] GET error:', err)
          }
        } else if (req.method === 'DELETE') {
          res.writeHead(405)
          res.end('Method Not Allowed')
        } else {
          res.writeHead(405)
          res.end('Method Not Allowed')
        }
      })

      const tryListen = (port: number): void => {
        this.httpServer!.listen(port, '127.0.0.1', () => {
          const addr = this.httpServer!.address()
          if (typeof addr === 'object' && addr) {
            this.port = addr.port
            this.writePortFile()
            resolve(this.port)
          } else {
            reject(new Error('Failed to get server address'))
          }
        })
      }

      this.httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[mcp] port ${PREFERRED_PORT} in use, falling back to random port`)
          this.httpServer!.removeAllListeners('error')
          this.httpServer!.on('error', reject)
          tryListen(0)
        } else {
          reject(err)
        }
      })

      tryListen(PREFERRED_PORT)
    })
  }

  private writePortFile(): void {
    const dir = path.dirname(PORT_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(PORT_FILE, String(this.port), 'utf-8')
  }

  stop(): void {
    this.httpServer?.close()
    this.httpServer = null
    try {
      if (fs.existsSync(PORT_FILE)) {
        fs.unlinkSync(PORT_FILE)
      }
    } catch { /* ignore */ }
  }
}
