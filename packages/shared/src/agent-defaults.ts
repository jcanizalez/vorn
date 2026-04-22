import { AiAgentType, AgentCommandConfig } from './types'

export const DEFAULT_AGENT_COMMANDS: Record<AiAgentType, AgentCommandConfig> = {
  claude: {
    command: 'claude',
    args: [],
    headlessArgs: ['--dangerously-skip-permissions']
  },
  copilot: {
    command: 'copilot',
    args: [],
    headlessArgs: ['--allow-all']
  },
  codex: {
    command: 'codex',
    args: [],
    headlessArgs: ['-a', 'never']
  },
  opencode: { command: 'opencode', args: [] },
  gemini: {
    command: 'gemini',
    args: [],
    headlessArgs: ['-y']
  }
}
