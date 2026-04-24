import { useEffect, useState } from 'react'
import { Zap, Clock, Calendar, ListPlus, ArrowRightLeft, Plug, type LucideIcon } from 'lucide-react'
import type { TriggerConfig, ConnectorPollTriggerConfig } from '../../../../shared/types'
import { ConnectorIcon } from '../../ConnectorIcon'

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
  taskStatusChanged: ArrowRightLeft,
  connectorPoll: Plug
}
const DEFAULT_ICON = Zap

function useConnectorId(config: TriggerConfig): string | null {
  const [connectorId, setConnectorId] = useState<string | null>(null)
  const connectionId =
    config.triggerType === 'connectorPoll'
      ? (config as ConnectorPollTriggerConfig).connectionId
      : null

  useEffect(() => {
    if (!connectionId) {
      setConnectorId(null)
      return
    }
    let cancelled = false
    window.api.listConnections().then((conns) => {
      if (cancelled) return
      const match = conns.find((c: { id: string }) => c.id === connectionId)
      setConnectorId(match?.connectorId ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [connectionId])

  return connectorId
}

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
    case 'connectorPoll':
      return `${config.event} · ${config.cron}`
  }
}

export function TriggerNode({ label, config, selected, onClick }: Props) {
  const Icon = TRIGGER_ICONS[config.triggerType] || DEFAULT_ICON
  const connectorId = useConnectorId(config)

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
        {connectorId ? (
          <ConnectorIcon connectorId={connectorId} size={14} className="text-blue-400 shrink-0" />
        ) : (
          <Icon size={14} className="text-blue-400 shrink-0" strokeWidth={2} />
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">{getSubtitle(config)}</div>
        </div>
      </div>
    </div>
  )
}
