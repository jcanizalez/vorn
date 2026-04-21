import type { AgentStatus } from '../../shared/types'

export const STATUS_DOT: Record<AgentStatus, string> = {
  running: 'bg-green-500',
  waiting: 'bg-yellow-500',
  idle: 'bg-gray-500',
  error: 'bg-red-500'
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  running: 'Running',
  waiting: 'Waiting',
  idle: 'Idle',
  error: 'Error'
}

export type StatusGlyph = 'shimmer' | 'circle-empty' | 'dot-solid'

// Only "running" shimmers — pulse is reserved for the one state where
// the agent is actively doing work. Waiting shows a static amber dot.
export const STATUS_GLYPH: Record<AgentStatus, StatusGlyph> = {
  running: 'shimmer',
  waiting: 'dot-solid',
  idle: 'circle-empty',
  error: 'dot-solid'
}

export const STATUS_TEXT: Record<AgentStatus, string> = {
  running: 'text-green-400',
  waiting: 'text-amber-400',
  idle: 'text-gray-500',
  error: 'text-red-500'
}
