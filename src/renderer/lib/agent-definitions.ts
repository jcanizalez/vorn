import { AgentType } from '../../shared/types'

export interface AgentDefinition {
  type: AgentType
  displayName: string
  color: string
  bgColor: string
  description: string
}

export const AGENT_DEFINITIONS: Record<AgentType, AgentDefinition> = {
  claude: {
    type: 'claude',
    displayName: 'Claude Code',
    color: '#D97757',
    bgColor: '#D9775720',
    description: 'Anthropic Claude Code CLI'
  },
  copilot: {
    type: 'copilot',
    displayName: 'GitHub Copilot',
    color: '#6CC644',
    bgColor: '#6CC64420',
    description: 'GitHub Copilot CLI'
  },
  codex: {
    type: 'codex',
    displayName: 'Codex',
    color: '#7A9DFF',
    bgColor: '#7A9DFF20',
    description: 'OpenAI Codex CLI'
  },
  opencode: {
    type: 'opencode',
    displayName: 'OpenCode',
    color: '#FFFFFF',
    bgColor: '#FFFFFF15',
    description: 'OpenCode CLI'
  },
  gemini: {
    type: 'gemini',
    displayName: 'Gemini CLI',
    color: '#3186FF',
    bgColor: '#3186FF20',
    description: 'Google Gemini CLI'
  }
}

export const AGENT_LIST = Object.values(AGENT_DEFINITIONS)
