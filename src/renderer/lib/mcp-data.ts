import { AgentType } from '../../shared/types'

export interface AgentMcpSetup {
  agentType: AgentType
  command: string
}

export const AGENT_MCP_SETUPS: AgentMcpSetup[] = [
  {
    agentType: 'claude',
    command: 'claude mcp add vorn -- npx -y @vornrun/mcp@latest'
  },
  {
    agentType: 'copilot',
    command: 'copilot mcp add vorn -- npx -y @vornrun/mcp@latest'
  },
  {
    agentType: 'codex',
    command: 'codex mcp add vorn -- npx -y @vornrun/mcp@latest'
  },
  {
    agentType: 'opencode',
    command: 'opencode mcp add vorn -- npx -y @vornrun/mcp@latest'
  },
  {
    agentType: 'gemini',
    command: 'gemini mcp add vorn -- npx -y @vornrun/mcp@latest'
  }
]
