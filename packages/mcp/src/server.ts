import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTaskTools } from './tools/tasks'
import { registerProjectTools } from './tools/projects'
import { registerSessionTools } from './tools/sessions'
import { registerWorkflowTools } from './tools/workflows'
import { registerGitTools } from './tools/git'
import { registerConfigTools } from './tools/config'

// Use the same dep types that tool files expect
import type { configManager } from '@vibegrid/server/config-manager'
import type { ptyManager } from '@vibegrid/server/pty-manager'
import type { scheduler } from '@vibegrid/server/scheduler'

export interface McpDeps {
  configManager: typeof configManager
  ptyManager: typeof ptyManager
  scheduler: typeof scheduler
}

export function createMcpServer(deps: McpDeps, version: string): McpServer {
  const server = new McpServer({ name: 'vibegrid', version }, { capabilities: { tools: {} } })

  registerGitTools(server)
  registerConfigTools(server, deps)
  registerProjectTools(server, deps)
  registerTaskTools(server, deps)
  registerSessionTools(server, deps)
  registerWorkflowTools(server, deps)

  return server
}
