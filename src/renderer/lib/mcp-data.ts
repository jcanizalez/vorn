import { AgentType } from '../../shared/types'

export interface AgentMcpSetup {
  agentType: AgentType
  command: string
}

export const AGENT_MCP_SETUPS: AgentMcpSetup[] = [
  {
    agentType: 'claude',
    command: 'claude mcp add vibegrid -- npx -y @vibegrid/mcp@latest'
  },
  {
    agentType: 'copilot',
    command: 'copilot mcp add vibegrid -- npx -y @vibegrid/mcp@latest'
  },
  {
    agentType: 'codex',
    command: 'codex mcp add vibegrid -- npx -y @vibegrid/mcp@latest'
  },
  {
    agentType: 'opencode',
    command: 'opencode mcp add vibegrid -- npx -y @vibegrid/mcp@latest'
  },
  {
    agentType: 'gemini',
    command: 'gemini mcp add vibegrid -- npx -y @vibegrid/mcp@latest'
  }
]
