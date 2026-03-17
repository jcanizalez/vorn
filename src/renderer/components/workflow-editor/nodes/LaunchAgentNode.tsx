import { AgentIcon } from '../../AgentIcon'
import type { LaunchAgentConfig, AgentType } from '../../../../shared/types'
import { useAppStore } from '../../../stores'
import { Server } from 'lucide-react'

interface Props {
  label: string
  config: LaunchAgentConfig
  selected?: boolean
  executionStatus?: string
  onClick: () => void
}

const AGENT_COLORS: Record<AgentType, string> = {
  claude: '#D97757',
  copilot: '#FFFFFF',
  codex: '#7A9DFF',
  opencode: '#FFFFFF',
  gemini: '#3186FF'
}

export function LaunchAgentNode({ label, config, selected, executionStatus, onClick }: Props) {
  const agentColor = AGENT_COLORS[config.agentType] || '#6b7280'
  const remoteHosts = useAppStore((s) => s.config?.remoteHosts)
  const remoteHost = config.remoteHostId
    ? remoteHosts?.find((h) => h.id === config.remoteHostId)
    : undefined

  const promptPreview = config.prompt
    ? config.prompt.length > 60
      ? config.prompt.slice(0, 60) + '...'
      : config.prompt
    : config.taskFromQueue
      ? 'Next task from queue'
      : config.taskId
        ? 'From task'
        : undefined

  const statusColor =
    executionStatus === 'running'
      ? 'border-yellow-500'
      : executionStatus === 'success'
        ? 'border-green-500'
        : executionStatus === 'error'
          ? 'border-red-500'
          : selected
            ? 'border-blue-500'
            : 'border-white/[0.12]'

  const statusBg =
    executionStatus === 'running'
      ? 'bg-yellow-500/10'
      : executionStatus === 'success'
        ? 'bg-green-500/10'
        : executionStatus === 'error'
          ? 'bg-red-500/10'
          : selected
            ? 'bg-blue-500/10'
            : 'bg-[#232328]'

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`px-4 py-3 rounded-lg border-2 w-[280px] transition-colors cursor-pointer
                  ${statusColor} ${statusBg}
                  hover:border-white/[0.2]`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${agentColor}20` }}
        >
          <AgentIcon agentType={config.agentType} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {config.projectName || 'No project'}
            {!remoteHost && config.branch && ` · ${config.branch}`}
          </div>
          {remoteHost && (
            <div className="flex items-center gap-1 mt-0.5">
              <Server size={9} className="text-blue-400" strokeWidth={1.5} />
              <span className="text-[10px] text-blue-400 truncate">{remoteHost.label}</span>
            </div>
          )}
        </div>
      </div>
      {promptPreview && (
        <div className="mt-2 text-[11px] text-gray-600 truncate border-t border-white/[0.06] pt-2">
          {promptPreview}
        </div>
      )}
    </div>
  )
}
