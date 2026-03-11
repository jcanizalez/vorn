import { execFileSync } from 'node:child_process'
import { AgentType, AgentCommandConfig, CreateTerminalPayload } from '../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'
import { shellEscape } from './pty-manager'

function commandExists(cmd: string, env: Record<string, string>): boolean {
  try {
    const bin = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(bin, [cmd], { stdio: 'pipe', timeout: 3000, env })
    return true
  } catch {
    return false
  }
}

function resolveAgentCommand(
  config: AgentCommandConfig,
  env: Record<string, string>
): { command: string; args: string[] } {
  if (commandExists(config.command, env)) {
    return { command: config.command, args: config.args }
  }
  if (config.fallbackCommand && commandExists(config.fallbackCommand, env)) {
    return { command: config.fallbackCommand, args: config.fallbackArgs ?? [] }
  }
  return { command: config.command, args: config.args }
}

/**
 * Builds the interactive launch command (for PTY/terminal sessions).
 * This starts the agent's TUI/interactive mode.
 */
export function buildAgentLaunchLine(
  payload: CreateTerminalPayload,
  agentCommands: Record<AgentType, AgentCommandConfig>,
  env: Record<string, string>
): string {
  const cmdConfig = agentCommands[payload.agentType] || DEFAULT_AGENT_COMMANDS[payload.agentType]
  const cmd = resolveAgentCommand(cmdConfig, env)
  let launchLine = [cmd.command, ...cmd.args].join(' ')

  if (payload.resumeSessionId) {
    switch (payload.agentType) {
      case 'claude':
        launchLine += ` --resume ${payload.resumeSessionId}`
        break
      case 'copilot':
        launchLine += ` --resume ${payload.resumeSessionId}`
        break
      case 'codex':
        launchLine = `${cmd.command} resume ${payload.resumeSessionId}`
        break
      case 'opencode':
        launchLine += ` --session ${payload.resumeSessionId}`
        break
      case 'gemini':
        launchLine += ` --resume latest`
        break
    }
  }

  if (payload.initialPrompt) {
    const escaped = shellEscape(payload.initialPrompt)
    switch (payload.agentType) {
      case 'copilot':
        launchLine += ` -i ${escaped}`
        break
      case 'gemini':
        launchLine += ` -i ${escaped}`
        break
      case 'opencode':
        launchLine += ` --prompt ${escaped}`
        break
      default:
        launchLine += ` ${escaped}`
        break
    }
  }

  return launchLine
}

/**
 * Builds the non-interactive launch command (for headless/background execution).
 * Uses each agent's native non-interactive mode:
 *   claude  → claude -p 'prompt'
 *   copilot → copilot -p 'prompt'
 *   codex   → codex exec 'prompt'
 *   opencode → opencode run 'prompt'
 *   gemini  → gemini -p 'prompt'
 */
export function buildHeadlessLaunchLine(
  payload: CreateTerminalPayload,
  agentCommands: Record<AgentType, AgentCommandConfig>,
  env: Record<string, string>
): string {
  const cmdConfig = agentCommands[payload.agentType] || DEFAULT_AGENT_COMMANDS[payload.agentType]
  const cmd = resolveAgentCommand(cmdConfig, env)
  const baseCmd = cmd.command

  const prompt = payload.initialPrompt ? shellEscape(payload.initialPrompt) : "''"

  switch (payload.agentType) {
    case 'claude':
      // claude -p 'prompt'  (--print mode, exits after completion)
      return `${baseCmd} -p ${prompt}`

    case 'copilot':
      // copilot -p 'prompt'  (non-interactive prompt mode)
      return `${baseCmd} -p ${prompt}`

    case 'codex':
      // codex exec 'prompt'  (non-interactive exec subcommand)
      return `${baseCmd} exec ${prompt}`

    case 'opencode':
      // opencode run 'prompt'  (non-interactive run subcommand)
      return `${baseCmd} run ${prompt}`

    case 'gemini':
      // gemini -p 'prompt'  (non-interactive prompt mode)
      return `${baseCmd} -p ${prompt}`

    default:
      // Fallback: try -p flag
      return `${baseCmd} -p ${prompt}`
  }
}

/**
 * Returns { command, args } for direct spawn (no shell wrapper).
 * Avoids TTY/stdin issues that occur when spawning through sh -c in Node.js.
 */
export function buildHeadlessSpawnArgs(
  payload: CreateTerminalPayload,
  agentCommands: Record<AgentType, AgentCommandConfig>,
  env: Record<string, string>
): { command: string; args: string[] } {
  const cmdConfig = agentCommands[payload.agentType] || DEFAULT_AGENT_COMMANDS[payload.agentType]
  const cmd = resolveAgentCommand(cmdConfig, env)
  const prompt = payload.initialPrompt || ''

  switch (payload.agentType) {
    case 'claude':
      return { command: cmd.command, args: ['-p', prompt] }
    case 'copilot':
      return { command: cmd.command, args: ['-p', prompt] }
    case 'codex':
      return { command: cmd.command, args: ['exec', prompt] }
    case 'opencode':
      return { command: cmd.command, args: ['run', prompt] }
    case 'gemini':
      return { command: cmd.command, args: ['-p', prompt] }
    default:
      return { command: cmd.command, args: ['-p', prompt] }
  }
}
