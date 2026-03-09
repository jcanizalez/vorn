import { useState, useRef } from 'react'
import { TaskConfig, TaskStatus } from '../../../shared/types'
import { TaskCard, STATUS_BADGE } from './TaskCard'

const KANBAN_COLUMNS: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'todo', title: 'Todo', color: 'border-gray-500/30' },
  { status: 'in_progress', title: 'In Progress', color: 'border-blue-500/30' },
  { status: 'in_review', title: 'In Review', color: 'border-purple-500/30' },
  { status: 'done', title: 'Done', color: 'border-green-500/30' },
  { status: 'cancelled', title: 'Cancelled', color: 'border-gray-500/20' }
]

export function TaskKanbanBoard({ allTasks, onEdit, onDelete, onStart, onDrop, onOpenSession, onComplete, onCancel, onReopen, onReviewDiff, onSelect, isSessionLive }: {
  allTasks: TaskConfig[]
  onEdit: (task: TaskConfig) => void
  onDelete: (id: string) => void
  onStart: (task: TaskConfig) => void
  onDrop: (taskId: string, newStatus: TaskStatus) => void
  onOpenSession: (task: TaskConfig) => (() => void) | undefined
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  onReopen: (id: string) => void
  onReviewDiff: (id: string) => void
  onSelect?: (task: TaskConfig) => void
  isSessionLive: (task: TaskConfig) => boolean
}) {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)
  const dragTaskId = useRef<string | null>(null)

  const handleDragStart = (taskId: string) => {
    dragTaskId.current = taskId
  }

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setDragOverCol(status)
  }

  const handleDragLeave = () => {
    setDragOverCol(null)
  }

  const handleDrop = (status: TaskStatus) => {
    if (dragTaskId.current) {
      onDrop(dragTaskId.current, status)
      dragTaskId.current = null
    }
    setDragOverCol(null)
  }

  return (
    <div className="flex gap-3 flex-1 overflow-x-auto min-h-0">
      {KANBAN_COLUMNS.map((col) => {
        const tasks = allTasks
          .filter((t) => t.status === col.status)
          .sort((a, b) => a.order - b.order)
        const badge = STATUS_BADGE[col.status]
        const isDragOver = dragOverCol === col.status

        return (
          <div
            key={col.status}
            className={`flex-1 min-w-[200px] flex flex-col rounded-lg border transition-all duration-200 ${
              isDragOver
                ? `${col.color} bg-white/[0.03] ring-1 ring-inset ${col.color.replace('border-', 'ring-')}`
                : 'border-white/[0.06]'
            }`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(col.status)}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
              <span className={`text-[11px] font-medium uppercase tracking-wider ${badge.color}`}>
                {col.title}
              </span>
              <span className="text-[10px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-4">No tasks</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <TaskCard
                      task={task}
                      onEdit={() => onEdit(task)}
                      onDelete={() => onDelete(task.id)}
                      onStart={() => onStart(task)}
                      onOpenSession={onOpenSession(task)}
                      onComplete={() => onComplete(task.id)}
                      onCancel={() => onCancel(task.id)}
                      onReopen={() => onReopen(task.id)}
                      onReviewDiff={() => onReviewDiff(task.id)}
                      onSelect={onSelect ? () => onSelect(task) : undefined}
                      sessionIsLive={isSessionLive(task)}
                      compact
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
