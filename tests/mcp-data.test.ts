import { describe, it, expect } from 'vitest'
import { AGENT_MCP_SETUPS } from '../src/renderer/lib/mcp-data'
import { AGENT_LIST } from '../src/renderer/lib/agent-definitions'

describe('AGENT_MCP_SETUPS', () => {
  it('has one setup per agent', () => {
    expect(AGENT_MCP_SETUPS).toHaveLength(AGENT_LIST.length)
  })

  it('each setup has agentType and command', () => {
    for (const setup of AGENT_MCP_SETUPS) {
      expect(setup.agentType).toBeTruthy()
      expect(setup.command).toBeTruthy()
      expect(setup.command).toContain('mcp add vibegrid')
    }
  })

  it('covers all known agent types', () => {
    const setupTypes = AGENT_MCP_SETUPS.map((s) => s.agentType)
    const agentTypes = AGENT_LIST.map((a) => a.type)
    expect(setupTypes.sort()).toEqual(agentTypes.sort())
  })

  it('each command starts with the agent name', () => {
    for (const setup of AGENT_MCP_SETUPS) {
      expect(setup.command.startsWith(setup.agentType)).toBe(true)
    }
  })
})
