import { Shield, Check, X } from 'lucide-react'
import type { PermissionRequestInfo } from '@vibegrid/shared/types'
import type { WsClient } from '../api/ws-client'

interface PermissionBannerProps {
  requests: PermissionRequestInfo[]
  client: WsClient
}

export function PermissionBanner({ requests, client }: PermissionBannerProps) {
  const current = requests[0]
  if (!current) return null

  const handleResolve = async (allow: boolean) => {
    try {
      await client.request('permission:resolve', {
        requestId: current.requestId,
        allow
      })
    } catch {
      // resolve failed
    }
  }

  const toolDisplay =
    current.toolName === 'AskUserQuestion'
      ? (current.questions?.[0]?.question ?? 'Agent has a question')
      : current.toolName

  const description = current.description
    ? current.description
    : current.toolName === 'AskUserQuestion'
      ? undefined
      : `${current.agentType ?? 'Agent'} wants to use ${current.toolName}`

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-yellow-300 truncate">{toolDisplay}</div>
          {description && (
            <div className="text-xs text-yellow-400/70 mt-0.5 truncate">{description}</div>
          )}
          {current.projectName && (
            <div className="text-xs text-gray-500 mt-0.5">{current.projectName}</div>
          )}
          {requests.length > 1 && (
            <div className="text-xs text-yellow-400/50 mt-1">
              +{requests.length - 1} more pending
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleResolve(false)}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
          >
            <X className="w-3 h-3" />
            Deny
          </button>
          <button
            onClick={() => handleResolve(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-xs font-medium rounded-lg transition-colors"
          >
            <Check className="w-3 h-3" />
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
