import { TaskConfig } from '../../../shared/types'
import { AgentIcon } from '../AgentIcon'
import {
  STATUS_ICON,
  STATUS_ICON_COLOR,
  formatTaskDate,
  getTaskShortId
} from '../../lib/task-status'
import {
  Pencil,
  Trash2,
  Play,
  Terminal,
  RotateCcw,
  FileCode,
  XCircle,
  CheckCircle2
} from 'lucide-react'
import { ConfirmPopover } from '../ConfirmPopover'
import { KanbanCardMenu } from './KanbanCardMenu'

export function TaskCard({
  task,
  onEdit,
  onDelete,
  onStart,
  onOpenSession,
  onComplete,
  onCancel,
  onReopen,
  onReviewDiff,
  onSelect,
  sessionIsLive,
  variant = 'default'
}: {
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
  variant?: 'default' | 'kanban'
}) {
  const StatusIcon = STATUS_ICON[task.status]
  const iconColor = STATUS_ICON_COLOR[task.status]
  const shortId = getTaskShortId(task)

  if (variant === 'kanban') {
    return (
      <div
        className={`group relative bg-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden
                     hover:bg-white/[0.06] hover:border-white/[0.1] hover:shadow-md
                     transition-all duration-150
                     ${task.status === 'cancelled' ? 'opacity-60' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
        onClick={onSelect}
      >
        <div className="px-3.5 py-3">
          {/* Top row: short ID + menu */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-500 font-medium">{shortId}</span>
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <KanbanCardMenu
                status={task.status}
                onStart={onStart}
                onEdit={onEdit}
                onDelete={onDelete}
                onOpenSession={onOpenSession}
                onComplete={onComplete}
                onCancel={onCancel}
                onReopen={onReopen}
                onReviewDiff={onReviewDiff}
                sessionIsLive={sessionIsLive}
              />
            </div>
          </div>

          {/* Status icon + Title */}
          <div className="flex items-start gap-1.5">
            <StatusIcon size={14} className={`${iconColor} mt-0.5 shrink-0`} />
            <span
              className={`text-[13px] font-medium leading-snug line-clamp-2
                           ${task.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-200'}`}
            >
              {task.title}
            </span>
          </div>

          {/* Footer: agent/session on left, date on right */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1.5">
              {task.assignedAgent && (
                <span className="flex items-center gap-1">
                  <AgentIcon agentType={task.assignedAgent} size={13} />
                  {sessionIsLive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
                  )}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-600">
              Created {formatTaskDate(task.createdAt)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Default variant — Linear-style flat row
  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] rounded-md transition-colors
                   ${task.status === 'cancelled' ? 'opacity-60' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      {/* Agent icon or priority placeholder */}
      <div className="w-4 shrink-0 flex items-center justify-center">
        {task.assignedAgent ? (
          <AgentIcon agentType={task.assignedAgent} size={14} />
        ) : (
          <span className="text-[10px] text-gray-600">---</span>
        )}
      </div>

      {/* Task short ID */}
      <span className="text-[11px] text-gray-500 font-medium w-14 shrink-0">{shortId}</span>

      {/* Status icon */}
      <StatusIcon size={14} className={`${iconColor} shrink-0`} />

      {/* Title */}
      <span
        className={`text-sm truncate flex-1 min-w-0 ${
          task.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-200'
        }`}
      >
        {task.title}
      </span>

      {/* Right side: date */}
      <span className="text-[11px] text-gray-500 shrink-0">{formatTaskDate(task.createdAt)}</span>

      {/* Hover actions */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
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
            {sessionIsLive ? (
              <Terminal size={12} strokeWidth={2} />
            ) : (
              <Play size={12} strokeWidth={2} />
            )}
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
  )
}
