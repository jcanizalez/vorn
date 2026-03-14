import { TaskConfig } from '../../../shared/types'
import { AgentIcon } from '../AgentIcon'
import { MarkdownPreview } from '../MarkdownEditor'
import { stripMarkdown } from '../../lib/markdown-utils'
import { STATUS_BADGE, STATUS_ICON, STATUS_ACCENT } from '../../lib/task-status'
import {
  Pencil,
  Trash2,
  Play,
  Terminal,
  RotateCcw,
  FileCode,
  ImageIcon,
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
  const badge = STATUS_BADGE[task.status]
  const StatusIcon = STATUS_ICON[task.status]
  const accent = STATUS_ACCENT[task.status]

  if (variant === 'kanban') {
    const strippedDesc = task.description ? stripMarkdown(task.description) : ''

    return (
      <div
        className={`group relative bg-white/[0.05] border border-white/[0.08] rounded-lg overflow-hidden
                     shadow-sm hover:bg-white/[0.07] hover:border-white/[0.12] hover:shadow-md
                     transition-all duration-150
                     ${task.status === 'cancelled' ? 'opacity-60' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
        onClick={onSelect}
      >
        {/* Left accent bar (Jira-style) */}
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent.bar}`} />

        <div className="pl-3.5 pr-3 py-2.5">
          {/* Title */}
          <span
            className={`text-[13px] font-medium leading-snug line-clamp-2 block
                         ${task.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-200'}`}
          >
            {task.title}
          </span>

          {/* Description preview (stripped, one line) */}
          {strippedDesc && (
            <p className="text-xs text-gray-500 line-clamp-1 mt-1">{strippedDesc}</p>
          )}

          {/* Metadata footer */}
          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {/* Left: agent + session indicator + images */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {task.assignedAgent && (
                <span className="flex items-center gap-1">
                  <AgentIcon agentType={task.assignedAgent} size={13} />
                  {sessionIsLive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
                  )}
                </span>
              )}
              {task.images && task.images.length > 0 && (
                <span
                  className="flex items-center gap-0.5 text-gray-600"
                  title={`${task.images.length} image${task.images.length !== 1 ? 's' : ''}`}
                >
                  <ImageIcon size={11} strokeWidth={2} />
                  <span className="text-[10px]">{task.images.length}</span>
                </span>
              )}
              {task.branch && (
                <span
                  className="text-[10px] text-gray-600 truncate max-w-[100px]"
                  title={task.branch}
                >
                  {task.branch}
                </span>
              )}
            </div>

            {/* Right: overflow menu */}
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
      </div>
    )
  }

  // Default variant (list view) — unchanged
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
            <span
              className={`text-sm font-medium truncate ${task.status === 'cancelled' ? 'text-gray-500 line-through' : 'text-gray-200'}`}
            >
              {task.title}
            </span>
            {task.assignedAgent && <AgentIcon agentType={task.assignedAgent} size={14} />}
            {task.images && task.images.length > 0 && (
              <span
                className="flex items-center gap-0.5 text-gray-600"
                title={`${task.images.length} image${task.images.length !== 1 ? 's' : ''}`}
              >
                <ImageIcon size={11} strokeWidth={2} />
                <span className="text-[10px]">{task.images.length}</span>
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <MarkdownPreview content={task.description} className="line-clamp-3" />
          </div>
        </div>
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
    </div>
  )
}
