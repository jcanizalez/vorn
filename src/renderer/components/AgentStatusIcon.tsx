import type { AgentStatus, AgentType } from '../../shared/types'
import { AgentIcon } from './AgentIcon'
import { ShimmerGlyph } from './ShimmerGlyph'

interface Props {
  agentType: AgentType
  status: AgentStatus
  size?: number
}

/**
 * The agent icon doubles as the running-state indicator: when the session is
 * running, the identity icon transforms into the opencode-style shimmer
 * glyph. Idle / waiting / error keep the plain identity icon. One visual
 * token carrying both identity and state — used in the sidebar and the
 * mini-card header.
 */
export function AgentStatusIcon({ agentType, status, size = 14 }: Props) {
  if (status === 'running') {
    return <ShimmerGlyph size={size} className="text-green-400" aria-label="Running" />
  }
  return <AgentIcon agentType={agentType} size={size} />
}
