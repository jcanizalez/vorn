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
