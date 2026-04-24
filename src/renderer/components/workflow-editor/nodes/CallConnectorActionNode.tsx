import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import type { CallConnectorActionConfig, NodeExecutionStatus } from '../../../../shared/types'
import { STATUS_DOT_CLASSES } from '../statusDot'
import { ConnectorIcon } from '../../ConnectorIcon'

interface Props {
  label: string
  config: CallConnectorActionConfig
  selected?: boolean
  executionStatus?: NodeExecutionStatus
  onClick: () => void
}

function useConnectorId(connectionId: string | undefined): string | null {
  const [connectorId, setConnectorId] = useState<string | null>(null)

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

export function CallConnectorActionNode({
  label,
  config,
  selected,
  executionStatus,
  onClick
}: Props) {
  const connectorId = useConnectorId(config.connectionId)

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`relative px-3 py-2.5 rounded-sm border w-[280px] transition-all cursor-pointer
                  ${selected ? 'border-blue-500/60' : 'border-white/[0.08]'}
                  bg-[#1d1d20] hover:bg-white/[0.02]`}
    >
      {executionStatus && STATUS_DOT_CLASSES[executionStatus] && (
        <span
          className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${STATUS_DOT_CLASSES[executionStatus]}`}
        />
      )}
      <div className="flex items-center gap-2">
        {connectorId ? (
          <ConnectorIcon connectorId={connectorId} size={14} className="text-gray-400 shrink-0" />
        ) : (
          <Zap size={14} className="text-gray-400 shrink-0" strokeWidth={2} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {config.action || 'Select action'}
          </div>
        </div>
      </div>
    </div>
  )
}
