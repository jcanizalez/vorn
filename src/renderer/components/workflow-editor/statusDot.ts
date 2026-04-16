import type { NodeExecutionStatus } from '../../../shared/types'

export const STATUS_DOT_CLASSES: Record<NodeExecutionStatus | 'running', string> = {
  success: 'bg-green-400',
  error: 'bg-red-500',
  running: 'bg-yellow-400 animate-pulse',
  pending: 'bg-gray-600',
  skipped: 'bg-gray-600'
}
