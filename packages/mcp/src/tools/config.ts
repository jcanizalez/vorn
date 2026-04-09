import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { configManager } from '@vornrun/server/config-manager'

export function registerConfigTools(server: McpServer): void {
  server.tool(
    'get_config',
    'Get the full Vorn configuration (projects, tasks, workflows, settings)',
    async () => {
      const config = configManager.loadConfig()
      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] }
    }
  )
}
