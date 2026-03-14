import { useState, useRef } from 'react'
import { TaskConfig, TaskStatus } from '../../../shared/types'
import { TaskCard } from './TaskCard'
import { STATUS_ACCENT } from '../../lib/task-status'

const KANBAN_COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'Todo' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'in_review', title: 'In Review' },
  { status: 'done', title: 'Done' },
  { status: 'cancelled', title: 'Cancelled' }
]

export function TaskKanbanBoard({
  allTasks,
  onEdit,
  onDelete,
  onStart,
  onDrop,
  onOpenSession,
  onComplete,
  onCancel,
  onReopen,
  onReviewDiff,
  onSelect,
  isSessionLive
}: {
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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragTaskId = useRef<string | null>(null)
  const dragEnterCount = useRef<Map<TaskStatus, number>>(new Map())

  const handleDragStart = (taskId: string) => {
    dragTaskId.current = taskId
    setDraggingId(taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragEnter = (status: TaskStatus) => {
    const count = (dragEnterCount.current.get(status) ?? 0) + 1
    dragEnterCount.current.set(status, count)
    setDragOverCol(status)
  }

  const handleDragLeave = (status: TaskStatus) => {
    const count = (dragEnterCount.current.get(status) ?? 1) - 1
    dragEnterCount.current.set(status, count)
    if (count <= 0) {
      dragEnterCount.current.delete(status)
      if (dragOverCol === status) setDragOverCol(null)
    }
  }

  const handleDrop = (status: TaskStatus) => {
    if (dragTaskId.current) {
      onDrop(dragTaskId.current, status)
      dragTaskId.current = null
    }
    dragEnterCount.current.clear()
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDragEnd = () => {
    dragTaskId.current = null
    dragEnterCount.current.clear()
    setDraggingId(null)
    setDragOverCol(null)
  }

  return (
    <div className="flex gap-2 flex-1 min-h-0">
      {KANBAN_COLUMNS.map((col) => {
        const tasks = allTasks
          .filter((t) => t.status === col.status)
          .sort((a, b) => a.order - b.order)
        const accent = STATUS_ACCENT[col.status]
        const isDragOver = dragOverCol === col.status

        return (
          <div
            key={col.status}
            className={`flex-1 min-w-0 flex flex-col rounded-lg transition-all duration-200 ${
              isDragOver ? 'bg-white/[0.04] ring-1 ring-inset ring-white/[0.1]' : 'bg-white/[0.02]'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={() => handleDragEnter(col.status)}
            onDragLeave={() => handleDragLeave(col.status)}
            onDrop={() => handleDrop(col.status)}
          >
            {/* Column header */}
            <div className="px-3 py-3 flex items-center gap-2 shrink-0">
              <span className={`w-2 h-2 rounded-full ${accent.dot} shrink-0`} />
              <span className="text-[13px] font-medium text-gray-300">{col.title}</span>
              <span className="text-[11px] text-gray-500 ml-0.5">{tasks.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 pt-0 space-y-2">
              {tasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[80px]">
                  <div className="border border-dashed border-white/[0.08] rounded-lg px-4 py-5 text-center w-full">
                    <p className="text-xs text-gray-600">Drop tasks here</p>
                  </div>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-grab active:cursor-grabbing transition-opacity duration-150"
                    style={{ opacity: draggingId === task.id ? 0.4 : 1 }}
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
                      variant="kanban"
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
