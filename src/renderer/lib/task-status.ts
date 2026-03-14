import { TaskStatus } from '../../shared/types'
import { Circle, Clock, Eye, CheckCircle2, XCircle } from 'lucide-react'

export const STATUS_BADGE: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: 'Todo', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  in_review: { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-500/10' }
}

export const STATUS_ICON: Record<TaskStatus, React.FC<{ size?: number; className?: string }>> = {
  todo: Circle,
  in_progress: Clock,
  in_review: Eye,
  done: CheckCircle2,
  cancelled: XCircle
}

export const STATUS_ACCENT: Record<TaskStatus, { dot: string; bar: string }> = {
  todo: { dot: 'bg-gray-400', bar: 'bg-gray-400' },
  in_progress: { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  in_review: { dot: 'bg-purple-500', bar: 'bg-purple-500' },
  done: { dot: 'bg-green-500', bar: 'bg-green-500' },
  cancelled: { dot: 'bg-gray-600', bar: 'bg-gray-600' }
}

export const STATUS_ICON_COLOR: Record<TaskStatus, string> = {
  todo: 'text-gray-400',
  in_progress: 'text-yellow-500',
  in_review: 'text-purple-400',
  done: 'text-green-500',
  cancelled: 'text-gray-500'
}

export const STATUS_HEADER_BG: Record<TaskStatus, string> = {
  todo: 'bg-gray-500/10',
  in_progress: 'bg-blue-500/10',
  in_review: 'bg-purple-500/10',
  done: 'bg-green-500/10',
  cancelled: 'bg-gray-500/5'
}

export function formatTaskDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getTaskShortId(task: { projectName: string; id: string }): string {
  const prefix =
    task.projectName
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'TSK'
  const suffix = task.id.slice(0, 4).toUpperCase()
  return `${prefix}-${suffix}`
}
