import { Zap, Clock, Calendar, ListPlus, ArrowRightLeft, type LucideIcon } from 'lucide-react'
import type { TriggerConfig } from '../../../../shared/types'

interface Props {
  label: string
  config: TriggerConfig
  selected?: boolean
  onClick: () => void
}

const TRIGGER_ICONS: Record<string, LucideIcon> = {
  manual: Zap,
  once: Calendar,
  recurring: Clock,
  taskCreated: ListPlus,
  taskStatusChanged: ArrowRightLeft
}
const DEFAULT_ICON = Zap

function getSubtitle(config: TriggerConfig): string {
  switch (config.triggerType) {
    case 'manual':
      return 'Click to run'
    case 'once':
      return `Run at ${new Date(config.runAt).toLocaleString()}`
    case 'recurring':
      return `Cron: ${config.cron}`
    case 'taskCreated':
      return config.projectFilter ? `Project: ${config.projectFilter}` : 'Any project'
    case 'taskStatusChanged': {
      const parts: string[] = []
      if (config.fromStatus) parts.push(config.fromStatus)
      if (config.toStatus) parts.push(config.toStatus)
      const transition = parts.length === 2 ? `${parts[0]} → ${parts[1]}` : parts[0] || 'Any change'
      const project = config.projectFilter ? ` · ${config.projectFilter}` : ''
      return transition + project
    }
  }
}

export function TriggerNode({ label, config, selected, onClick }: Props) {
  const Icon = TRIGGER_ICONS[config.triggerType] || DEFAULT_ICON

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`px-4 py-3 rounded-lg border-2 w-[280px] transition-colors cursor-pointer
                  ${selected ? 'border-blue-500 bg-blue-500/10' : 'border-white/[0.12] bg-[#232328]'}
                  hover:border-white/[0.2]`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-md bg-blue-500/20 flex items-center justify-center">
          <Icon size={16} className="text-blue-400" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">{getSubtitle(config)}</div>
        </div>
      </div>
    </div>
  )
}
