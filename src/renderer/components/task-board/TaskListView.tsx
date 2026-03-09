import { TaskConfig } from '../../../shared/types'
import { TaskCard } from './TaskCard'

export function TaskListView({ sections, onEdit, onDelete, onStart, onOpenSession, onComplete, onCancel, onReopen, onReviewDiff, onSelect, isSessionLive }: {
  sections: { title: string; tasks: TaskConfig[]; emptyText: string }[]
  onEdit: (task: TaskConfig) => void
  onDelete: (id: string) => void
  onStart: (task: TaskConfig) => void
  onOpenSession: (task: TaskConfig) => (() => void) | undefined
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  onReopen: (id: string) => void
  onReviewDiff: (id: string) => void
  onSelect?: (task: TaskConfig) => void
  isSessionLive: (task: TaskConfig) => boolean
}) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {section.title}
            </span>
            <span className="text-[10px] text-gray-600 bg-white/[0.04] px-1.5 py-0.5 rounded-full">
              {section.tasks.length}
            </span>
          </div>
          {section.tasks.length === 0 ? (
            <p className="text-xs text-gray-600 py-2 pl-1">{section.emptyText}</p>
          ) : (
            <div className="space-y-1.5">
              {section.tasks.map((task) => (
                <TaskCard
                  key={task.id}
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
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
