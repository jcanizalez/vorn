import { AgentStatus } from '../../shared/types'

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string; pulse: boolean }> = {
  running: { color: 'bg-green-500', label: 'Running', pulse: true },
  waiting: { color: 'bg-yellow-500', label: 'Waiting', pulse: false },
  idle: { color: 'bg-gray-500', label: 'Idle', pulse: false },
  error: { color: 'bg-red-500', label: 'Error', pulse: false }
}

interface Props {
  status: AgentStatus
}

export function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status]

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse-dot' : ''}`}
      />
      <span className="text-xs text-gray-400">{config.label}</span>
    </div>
  )
}
