import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { configManager as ConfigManagerInstance } from '@vibegrid/server/config-manager'

type ConfigManager = typeof ConfigManagerInstance

export function registerConfigTools(
  server: McpServer,
  deps: { configManager: ConfigManager }
): void {
  const { configManager } = deps

  server.tool(
    'get_config',
    'Get the full VibeGrid configuration (projects, tasks, workflows, settings)',
    async () => {
      const config = configManager.loadConfig()
      return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] }
    }
  )
}
