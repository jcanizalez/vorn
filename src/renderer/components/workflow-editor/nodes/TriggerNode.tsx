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
      className={`px-3 py-2.5 rounded-md border w-[280px] transition-all cursor-pointer
                  ${selected ? 'border-blue-500/60 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]' : 'border-white/[0.08]'}
                  bg-[#1d1d20] hover:bg-white/[0.02]`}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-blue-400 shrink-0" strokeWidth={2} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">{getSubtitle(config)}</div>
        </div>
      </div>
    </div>
  )
}
