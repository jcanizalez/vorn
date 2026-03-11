import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTaskTools } from './mcp-tools/tasks'
import { registerProjectTools } from './mcp-tools/projects'
import { registerSessionTools } from './mcp-tools/sessions'
import { registerWorkflowTools } from './mcp-tools/workflows'
import { registerGitTools } from './mcp-tools/git'
import { registerConfigTools } from './mcp-tools/config'
import log from './logger'
import type { configManager as ConfigManagerInstance } from './config-manager'
import type { ptyManager as PtyManagerInstance } from './pty-manager'
import type { scheduler as SchedulerInstance } from './scheduler'

interface McpStdioDeps {
  configManager: typeof ConfigManagerInstance
  ptyManager: typeof PtyManagerInstance
  scheduler: typeof SchedulerInstance
}

export async function runStdioMcp(deps: McpStdioDeps): Promise<void> {
  // Redirect all console output to stderr so stdout stays clean for JSON-RPC.
  // electron-log already writes to file, but console.* from third-party libs
  // would still pollute stdout without this redirect.
  const stderr = process.stderr
  const write = (...args: unknown[]): void => {
    stderr.write(args.map(String).join(' ') + '\n')
  }
  console.log = write
  console.warn = write
  console.info = write
  console.debug = write
  console.error = write

  // Also disable electron-log's console transport so it doesn't write to stdout
  log.transports.console.level = false

  const server = new McpServer(
    { name: 'vibegrid', version: '0.5.0' },
    { capabilities: { tools: {} } }
  )

  const { configManager, ptyManager, scheduler } = deps
  registerProjectTools(server, { configManager })
  registerTaskTools(server, { configManager })
  registerSessionTools(server, { ptyManager })
  registerWorkflowTools(server, { configManager, scheduler })
  registerGitTools(server)
  registerConfigTools(server, { configManager })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  transport.onclose = () => {
    process.exit(0)
  }

  process.stdin.on('end', () => {
    process.exit(0)
  })
}
