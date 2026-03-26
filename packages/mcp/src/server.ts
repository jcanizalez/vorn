import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTaskTools } from './tools/tasks'
import { registerProjectTools } from './tools/projects'
import { registerSessionTools } from './tools/sessions'
import { registerWorkflowTools } from './tools/workflows'
import { registerConfigTools } from './tools/config'
import { registerWorkspaceTools } from './tools/workspaces'

export function createMcpServer(version: string): McpServer {
  const server = new McpServer({ name: 'vibegrid', version }, { capabilities: { tools: {} } })

  registerConfigTools(server)
  registerProjectTools(server)
  registerTaskTools(server)
  registerSessionTools(server)
  registerWorkflowTools(server)
  registerWorkspaceTools(server)

  return server
}
