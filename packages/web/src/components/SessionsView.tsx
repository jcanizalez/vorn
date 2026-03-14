import { useState } from 'react'
import { Plus, GitBranch } from 'lucide-react'
import type {
  AppConfig,
  TerminalSession,
  AgentType,
  AgentStatus,
  ProjectConfig
} from '@vibegrid/shared/types'
import type { WsClient } from '../api/ws-client'
import { TerminalOutput } from './TerminalOutput'

interface SessionsViewProps {
  sessions: TerminalSession[]
  config: AppConfig | null
  client: WsClient | null
}

const AGENT_EMOJI: Record<AgentType, string> = {
  claude: '\u{1F7E3}',
  copilot: '\u{1F7E2}',
  codex: '\u{1F7E1}',
  opencode: '\u{1F535}',
  gemini: '\u{1F534}'
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: 'bg-green-500',
  waiting: 'bg-yellow-500',
  idle: 'bg-gray-500',
  error: 'bg-red-500'
}

const STATUS_TEXT_COLORS: Record<AgentStatus, string> = {
  running: 'text-green-400',
  waiting: 'text-yellow-400',
  idle: 'text-gray-400',
  error: 'text-red-400'
}

export function SessionsView({ sessions, config, client }: SessionsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLaunch, setShowLaunch] = useState(false)
  const [launchAgent, setLaunchAgent] = useState<AgentType>('claude')
  const [launchProject, setLaunchProject] = useState('')
  const [launchPrompt, setLaunchPrompt] = useState('')
  const [launching, setLaunching] = useState(false)

  const selected = sessions.find((s) => s.id === selectedId)

  if (selected) {
    return <TerminalOutput session={selected} onBack={() => setSelectedId(null)} />
  }

  const handleLaunch = async () => {
    if (!client || !launchProject) return
    const project = config?.projects.find((p: ProjectConfig) => p.name === launchProject)
    if (!project) return

    setLaunching(true)
    try {
      await client.request('terminal:create', {
        agentType: launchAgent,
        projectName: project.name,
        projectPath: project.path,
        initialPrompt: launchPrompt || undefined
      })
      setShowLaunch(false)
      setLaunchPrompt('')
    } catch {
      // launch failed
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Sessions ({sessions.length})
        </h2>
        <button
          onClick={() => setShowLaunch(!showLaunch)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Launch Agent
        </button>
      </div>

      {/* Launch form */}
      {showLaunch && (
        <div className="bg-white/[0.06] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Agent</label>
            <select
              value={launchAgent}
              onChange={(e) => setLaunchAgent(e.target.value as AgentType)}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              {(['claude', 'copilot', 'codex', 'opencode', 'gemini'] as AgentType[]).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Project</label>
            <select
              value={launchProject}
              onChange={(e) => setLaunchProject(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Select project...</option>
              {(config?.projects ?? []).map((p: ProjectConfig) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Prompt (optional)</label>
            <textarea
              value={launchPrompt}
              onChange={(e) => setLaunchPrompt(e.target.value)}
              placeholder="Enter a prompt for the agent..."
              rows={3}
              className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.06] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLaunch}
              disabled={launching || !launchProject}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {launching ? 'Launching...' : 'Launch'}
            </button>
            <button
              onClick={() => setShowLaunch(false)}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-gray-400 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Session cards */}
      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2">{'  '}</div>
          <p className="text-sm text-gray-500">No active sessions</p>
          <p className="text-xs text-gray-600 mt-1">Launch an agent to get started</p>
        </div>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setSelectedId(session.id)}
            className="w-full text-left bg-white/[0.06] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.1] transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Agent emoji */}
              <span className="text-xl flex-shrink-0 mt-0.5">
                {AGENT_EMOJI[session.agentType] ?? '\u{26AA}'}
              </span>

              <div className="flex-1 min-w-0">
                {/* Name + status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {session.displayName ?? session.agentType}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_TEXT_COLORS[session.status]} bg-white/[0.06]`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[session.status]}`} />
                    {session.status}
                  </span>
                </div>

                {/* Project */}
                <div className="text-xs text-gray-500 mt-0.5 truncate">{session.projectName}</div>

                {/* Branch */}
                {session.branch && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                    <GitBranch className="w-3 h-3" />
                    <span className="truncate">{session.branch}</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  )
}
