import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { AgentType, AgentCommandConfig } from '../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'
import { configManager } from './config-manager'

const execFileAsync = promisify(execFile)

export type AgentInstallStatus = Record<AgentType, boolean>

async function commandExists(cmd: string): Promise<boolean> {
  try {
    const bin = process.platform === 'win32' ? 'where' : 'which'
    await execFileAsync(bin, [cmd], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}

let cachedStatus: AgentInstallStatus | null = null
let inflightPromise: Promise<AgentInstallStatus> | null = null

export async function detectInstalledAgents(): Promise<AgentInstallStatus> {
  if (cachedStatus) return cachedStatus
  if (inflightPromise) return inflightPromise

  inflightPromise = (async () => {
    const config = configManager.loadConfig()
    const agentCommands = config.agentCommands || {}

    const allAgents: AgentType[] = ['claude', 'copilot', 'codex', 'opencode', 'gemini']

    const results = await Promise.all(
      allAgents.map(async (agent) => {
        const cmdConfig: AgentCommandConfig = agentCommands[agent] || DEFAULT_AGENT_COMMANDS[agent]
        const primary = await commandExists(cmdConfig.command)
        const installed =
          primary ||
          (cmdConfig.fallbackCommand ? await commandExists(cmdConfig.fallbackCommand) : false)
        return [agent, installed] as const
      })
    )

    const result = Object.fromEntries(results) as AgentInstallStatus
    cachedStatus = result
    inflightPromise = null
    return result
  })()

  return inflightPromise
}

/** Clear the cache so next call re-detects. Call this after config changes. */
export function clearAgentDetectionCache(): void {
  cachedStatus = null
  inflightPromise = null
}
