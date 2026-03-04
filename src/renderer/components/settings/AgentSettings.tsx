import { useState } from 'react'
import { useAppStore } from '../../stores'
import { AgentType, AgentCommandConfig } from '../../../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../../../shared/agent-defaults'
import { AGENT_LIST } from '../../lib/agent-definitions'
import { AgentIcon } from '../AgentIcon'

export function AgentSettings() {
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const [editingArgs, setEditingArgs] = useState<Record<string, string>>({})

  if (!config) return null

  const getCommand = (agentType: AgentType): AgentCommandConfig => {
    return config.agentCommands?.[agentType] || DEFAULT_AGENT_COMMANDS[agentType]
  }

  const updateAgentCommand = (agentType: AgentType, patch: Partial<AgentCommandConfig>): void => {
    const current = getCommand(agentType)
    const updated = {
      ...config,
      agentCommands: {
        ...DEFAULT_AGENT_COMMANDS,
        ...config.agentCommands,
        [agentType]: { ...current, ...patch }
      }
    }
    window.api.saveConfig(updated)
    setConfig(updated)
  }

  const resetAgent = (agentType: AgentType): void => {
    const defaults = DEFAULT_AGENT_COMMANDS[agentType]
    const updated = {
      ...config,
      agentCommands: {
        ...DEFAULT_AGENT_COMMANDS,
        ...config.agentCommands,
        [agentType]: { ...defaults }
      }
    }
    window.api.saveConfig(updated)
    setConfig(updated)
    setEditingArgs((prev) => {
      const next = { ...prev }
      delete next[agentType]
      return next
    })
  }

  const getArgsString = (agentType: AgentType): string => {
    if (editingArgs[agentType] !== undefined) return editingArgs[agentType]
    return getCommand(agentType).args.join(' ')
  }

  const handleArgsChange = (agentType: AgentType, value: string): void => {
    setEditingArgs((prev) => ({ ...prev, [agentType]: value }))
  }

  const handleArgsBlur = (agentType: AgentType): void => {
    const value = editingArgs[agentType]
    if (value !== undefined) {
      const args = value.trim() ? value.trim().split(/\s+/) : []
      updateAgentCommand(agentType, { args })
      setEditingArgs((prev) => {
        const next = { ...prev }
        delete next[agentType]
        return next
      })
    }
  }

  const isModified = (agentType: AgentType): boolean => {
    const current = getCommand(agentType)
    const defaults = DEFAULT_AGENT_COMMANDS[agentType]
    return current.command !== defaults.command ||
           JSON.stringify(current.args) !== JSON.stringify(defaults.args)
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-1">Coding Agents</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure the command and arguments for each coding agent
      </p>

      <div className="space-y-3">
        {AGENT_LIST.map((agent) => {
          const cmd = getCommand(agent.type)
          const modified = isModified(agent.type)

          return (
            <div
              key={agent.type}
              className="border border-white/[0.06] rounded-lg p-4"
              style={{ background: 'rgba(0, 0, 0, 0.15)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <AgentIcon agentType={agent.type} size={20} />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-200">{agent.displayName}</span>
                  <span className="text-xs text-gray-600 ml-2">{agent.description}</span>
                </div>
                {modified && (
                  <button
                    onClick={() => resetAgent(agent.type)}
                    className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1
                               bg-white/[0.04] hover:bg-white/[0.08] rounded transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">
                    Command
                  </label>
                  <input
                    type="text"
                    value={cmd.command}
                    onChange={(e) => updateAgentCommand(agent.type, { command: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm
                               text-gray-200 font-mono focus:border-white/[0.15] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500 uppercase tracking-wider mb-1 block">
                    Arguments
                  </label>
                  <input
                    type="text"
                    value={getArgsString(agent.type)}
                    onChange={(e) => handleArgsChange(agent.type, e.target.value)}
                    onBlur={() => handleArgsBlur(agent.type)}
                    placeholder="e.g. --dangerously-skip-permissions"
                    className="w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm
                               text-gray-200 font-mono placeholder-gray-600 focus:border-white/[0.15] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
