#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { configManager } from '@vibegrid/server/config-manager'
import { ptyManager } from '@vibegrid/server/pty-manager'
import { scheduler } from '@vibegrid/server/scheduler'
import { createMcpServer } from './server'

// Redirect all console methods to stderr (stdout is reserved for JSON-RPC)
const _origError = console.error
console.log = (...args: unknown[]) => _origError('[mcp]', ...args)
console.info = (...args: unknown[]) => _origError('[mcp]', ...args)
console.debug = (...args: unknown[]) => _origError('[mcp:debug]', ...args)
console.warn = (...args: unknown[]) => _origError('[mcp:warn]', ...args)
console.error = (...args: unknown[]) => _origError('[mcp:error]', ...args)

async function main() {
  // Initialize managers (same as old --mcp mode)
  configManager.init()
  const config = configManager.loadConfig()
  if (config.agentCommands) {
    ptyManager.setAgentCommands(config.agentCommands)
  }
  ptyManager.setRemoteHosts(config.remoteHosts ?? [])
  scheduler.syncSchedules(config.workflows ?? [])

  const server = createMcpServer({ configManager, ptyManager, scheduler }, '0.7.2')
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Graceful shutdown
  transport.onclose = () => {
    scheduler.stopAll()
    ptyManager.killAll()
    configManager.close()
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err)
  process.exit(1)
})
