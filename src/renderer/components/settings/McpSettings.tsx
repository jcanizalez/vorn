import { useState, useEffect } from 'react'
import { AgentType } from '../../../shared/types'
import { AGENT_DEFINITIONS } from '../../lib/agent-definitions'
import { AgentIcon } from '../AgentIcon'

interface McpInfo {
  execPath: string
  platform: string
}

interface AgentMcpSetup {
  agentType: AgentType
  command: (bin: string) => string
}

const AGENT_SETUPS: AgentMcpSetup[] = [
  {
    agentType: 'claude',
    command: (bin) => `claude mcp add vibegrid -- ${bin} --mcp`
  },
  {
    agentType: 'copilot',
    command: (bin) => `copilot mcp add vibegrid -- ${bin} --mcp`
  },
  {
    agentType: 'codex',
    command: (bin) => `codex mcp add vibegrid -- ${bin} --mcp`
  },
  {
    agentType: 'opencode',
    command: (bin) => `opencode mcp add vibegrid -- ${bin} --mcp`
  },
  {
    agentType: 'gemini',
    command: (bin) => `gemini mcp add vibegrid -- ${bin} --mcp`
  }
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (): void => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08]
                 text-gray-400 hover:text-gray-200 transition-colors shrink-0"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function getCliInstallCommand(info: McpInfo): string | null {
  if (info.platform === 'darwin') {
    return `sudo ln -sf "${info.execPath}" /usr/local/bin/vibegrid`
  }
  if (info.platform === 'win32') {
    const dir = info.execPath.replace(/\\[^\\]+$/, '')
    return `setx PATH "%PATH%;${dir}"`
  }
  return null
}

export function McpSettings() {
  const [mcpInfo, setMcpInfo] = useState<McpInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getMcpInfo()
      .then(setMcpInfo)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">MCP Integration</h2>
        <p className="text-sm text-red-400">Failed to load MCP info: {error}</p>
      </div>
    )
  }

  const cliInstallCmd = mcpInfo ? getCliInstallCommand(mcpInfo) : null
  const cmdBin = 'vibegrid'

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-1">MCP Integration</h2>
      <p className="text-sm text-gray-500 mb-6">
        Connect your coding agents to VibeGrid via MCP
      </p>

      {/* CLI Install */}
      <div className="border border-white/[0.06] rounded-lg p-4 mb-6" style={{ background: '#141416' }}>
        <h3 className="text-sm font-medium text-gray-200 mb-2">Add to PATH</h3>
        <p className="text-xs text-gray-500 mb-3">
          Run this so agents can find <span className="font-mono text-gray-400">vibegrid</span> by name.
        </p>

        {cliInstallCmd && mcpInfo ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md
                           text-xs text-gray-300 font-mono overflow-x-auto whitespace-nowrap">
              {cliInstallCmd}
            </code>
            <CopyButton text={cliInstallCmd} />
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            On Linux, the binary is typically already in PATH from package installation.
          </p>
        )}
      </div>

      {/* Per-agent commands */}
      <h3 className="text-sm font-medium text-gray-200 mb-3">Agent Setup</h3>
      <div className="space-y-3">
        {AGENT_SETUPS.map((setup) => {
          const agent = AGENT_DEFINITIONS[setup.agentType]
          const cmd = setup.command(cmdBin)

          return (
            <div
              key={setup.agentType}
              className="border border-white/[0.06] rounded-lg p-4"
              style={{ background: '#141416' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <AgentIcon agentType={setup.agentType} size={20} />
                <span className="text-sm font-medium text-gray-200">{agent.displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md
                               text-xs text-gray-300 font-mono overflow-x-auto whitespace-nowrap">
                  {cmd}
                </code>
                <CopyButton text={cmd} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
