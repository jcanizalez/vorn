import { TaskConfig } from '../../../shared/types'
import { AgentIcon } from '../AgentIcon'
import { MarkdownPreview } from '../MarkdownEditor'
import { Pencil, Trash2, Play, CheckCircle2, Clock, Circle, X, Terminal, Eye, XCircle, RotateCcw, FileCode, ImageIcon } from 'lucide-react'
import { ConfirmPopover } from '../ConfirmPopover'

export const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'Todo', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  in_review: { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-500/10' }
}

export const STATUS_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  todo: Circle,
  in_progress: Clock,
  in_review: Eye,
  done: CheckCircle2,
  cancelled: XCircle
}

export function TaskCard({ task, onEdit, onDelete, onStart, onOpenSession, onComplete, onCancel, onReopen, onReviewDiff, onSelect, sessionIsLive, compact }: {
  task: TaskConfig
  onEdit: () => void
  onDelete: () => void
  onStart: () => void
  onOpenSession?: () => void
  onComplete?: () => void
  onCancel?: () => void
  onReopen?: () => void
  onReviewDiff?: () => void
  onSelect?: () => void
  sessionIsLive?: boolean
  compact?: boolean
}) {
  const badge = STATUS_BADGE[task.status]
  const StatusIcon = STATUS_ICON[task.status]

  return (
    <div
      className={`group bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 hover:border-white/[0.1] transition-colors
                   ${task.status === 'cancelled' ? 'opacity-60' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        <StatusIcon size={14} className={`${badge.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${task.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{task.title}</span>
            {task.assignedAgent && (
              <AgentIcon agentType={task.assignedAgent} size={14} />
            )}
            {task.images && task.images.length > 0 && (
              <span className="flex items-center gap-0.5 text-gray-600" title={`${task.images.length} image${task.images.length !== 1 ? 's' : ''}`}>
                <ImageIcon size={11} strokeWidth={2} />
                <span className="text-[10px]">{task.images.length}</span>
              </span>
            )}
          </div>
          {!compact && (
            <div className="mt-1.5">
              <MarkdownPreview content={task.description} className="line-clamp-3" />
            </div>
          )}
          {compact && task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
          {task.status === 'todo' && (
            <button
              onClick={onStart}
              className="p-1 text-gray-600 hover:text-green-400 rounded transition-colors"
              title="Start task now"
            >
              <Play size={12} strokeWidth={2} />
            </button>
          )}
          {task.status === 'in_review' && onReviewDiff && (
            <button
              onClick={onReviewDiff}
              className="p-1 text-gray-600 hover:text-purple-400 rounded transition-colors"
              title="Review diff"
            >
              <FileCode size={12} strokeWidth={2} />
            </button>
          )}
          {task.status === 'in_review' && onComplete && (
            <button
              onClick={onComplete}
              className="p-1 text-gray-600 hover:text-green-400 rounded transition-colors"
              title="Mark as done"
            >
              <CheckCircle2 size={12} strokeWidth={2} />
            </button>
          )}
          {task.status === 'cancelled' && onReopen && (
            <button
              onClick={onReopen}
              className="p-1 text-gray-600 hover:text-amber-400 rounded transition-colors"
              title="Reopen task"
            >
              <RotateCcw size={12} strokeWidth={2} />
            </button>
          )}
          {onOpenSession && (
            <button
              onClick={onOpenSession}
              className={`p-1 text-gray-600 rounded transition-colors ${sessionIsLive ? 'hover:text-violet-400' : 'hover:text-amber-400'}`}
              title={sessionIsLive ? 'Focus session' : 'Resume session'}
            >
              {sessionIsLive ? <Terminal size={12} strokeWidth={2} /> : <Play size={12} strokeWidth={2} />}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1 text-gray-600 hover:text-white rounded transition-colors"
            title="Edit task"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
          {task.status !== 'cancelled' && task.status !== 'done' && onCancel && (
            <button
              onClick={onCancel}
              className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
              title="Cancel task"
            >
              <XCircle size={12} strokeWidth={2} />
            </button>
          )}
          <ConfirmPopover
            message="Delete this task permanently?"
            confirmLabel="Delete"
            onConfirm={onDelete}
          >
            <button
              className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
              title="Delete task"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          </ConfirmPopover>
        </div>
      </div>
    </div>
  )
}
