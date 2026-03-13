import { Terminal, Code2 } from 'lucide-react'
import type { ScriptConfig } from '../../../../shared/types'

interface Props {
  label: string
  config: ScriptConfig
  selected?: boolean
  executionStatus?: string
  onClick: () => void
}

const SCRIPT_ICONS: Record<ScriptConfig['scriptType'], typeof Terminal> = {
  bash: Terminal,
  powershell: Terminal,
  python: Code2,
  node: Code2
}

const SCRIPT_COLORS: Record<ScriptConfig['scriptType'], string> = {
  bash: '#22c55e',
  powershell: '#3b82f6',
  python: '#eab308',
  node: '#22c55e'
}

export function ScriptNode({ label, config, selected, executionStatus, onClick }: Props) {
  const Icon = SCRIPT_ICONS[config.scriptType] || Terminal
  const color = SCRIPT_COLORS[config.scriptType] || '#6b7280'

  const preview = config.scriptContent
    ? config.scriptContent.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim()
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
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={16} style={{ color }} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {config.scriptType}
            {config.projectName && ` · ${config.projectName}`}
          </div>
        </div>
      </div>
      {preview && (
        <div className="mt-2 text-[11px] text-gray-600 truncate border-t border-white/[0.06] pt-2 font-mono">
          {preview.length > 50 ? preview.slice(0, 50) + '...' : preview}
        </div>
      )}
    </div>
  )
}
