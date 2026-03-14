import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { AppConfig, TaskConfig, TaskStatus } from '@vibegrid/shared/types'
import type { WsClient } from '../api/ws-client'

interface TasksViewProps {
  config: AppConfig | null
  client: WsClient | null
}

const STATUS_ORDER: TaskStatus[] = ['in_progress', 'todo', 'in_review', 'done']

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled'
}

const STATUS_BADGE_COLORS: Record<TaskStatus, string> = {
  todo: 'text-gray-400 bg-gray-500/20',
  in_progress: 'text-blue-400 bg-blue-500/20',
  in_review: 'text-yellow-400 bg-yellow-500/20',
  done: 'text-green-400 bg-green-500/20',
  cancelled: 'text-gray-500 bg-gray-500/10'
}

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-yellow-500',
  done: 'bg-green-500',
  cancelled: 'bg-gray-600'
}

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: 'in_progress',
  in_progress: 'in_review',
  in_review: 'done'
}

const PREV_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  in_progress: 'todo',
  in_review: 'in_progress',
  done: 'in_review'
}

export function TasksView({ config, client }: TasksViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TaskStatus>>(new Set())

  const tasks = config?.tasks ?? []

  const grouped = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t: TaskConfig) => t.status === status)
      return acc
    },
    {} as Record<TaskStatus, TaskConfig[]>
  )

  const toggleGroup = (status: TaskStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const updateTaskStatus = async (task: TaskConfig, newStatus: TaskStatus) => {
    if (!client || !config) return
    try {
      const updatedTasks = (config.tasks ?? []).map((t: TaskConfig) =>
        t.id === task.id ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
      )
      await client.request('config:save', { ...config, tasks: updatedTasks })
    } catch {
      // save failed
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Tasks</h2>
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No tasks</p>
          <p className="text-xs text-gray-600 mt-1">Tasks are managed from the desktop app</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
        Tasks ({tasks.length})
      </h2>

      {STATUS_ORDER.map((status) => {
        const group = grouped[status]
        if (group.length === 0) return null
        const collapsed = collapsedGroups.has(status)

        return (
          <div key={status}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(status)}
              className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide hover:text-gray-300 transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {STATUS_LABELS[status]} ({group.length})
            </button>

            {/* Task cards */}
            {!collapsed && (
              <div className="space-y-2">
                {group.map((task: TaskConfig) => {
                  const expanded = expandedId === task.id
                  return (
                    <div
                      key={task.id}
                      className="bg-white/[0.06] border border-white/[0.06] rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedId(expanded ? null : task.id)}
                        className="w-full text-left p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[task.status]}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {task.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 truncate">
                                {task.projectName}
                              </span>
                              {task.assignedAgent && (
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE_COLORS[task.status]}`}
                                >
                                  {task.assignedAgent}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded details */}
                      {expanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-white/[0.06]">
                          {task.description && (
                            <p className="text-xs text-gray-400 mt-3 whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}
                          {task.branch && (
                            <div className="text-xs text-gray-500 mt-2">Branch: {task.branch}</div>
                          )}

                          {/* Status buttons */}
                          <div className="flex gap-2 mt-3">
                            {PREV_STATUS[task.status] && (
                              <button
                                onClick={() => updateTaskStatus(task, PREV_STATUS[task.status]!)}
                                className="flex-1 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-gray-400 text-xs rounded-lg transition-colors"
                              >
                                {STATUS_LABELS[PREV_STATUS[task.status]!]}
                              </button>
                            )}
                            {NEXT_STATUS[task.status] && (
                              <button
                                onClick={() => updateTaskStatus(task, NEXT_STATUS[task.status]!)}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                {STATUS_LABELS[NEXT_STATUS[task.status]!]}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
