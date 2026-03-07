import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { TaskConfig, TaskStatus, TaskViewMode } from '../../shared/types'
import { AgentIcon } from './AgentIcon'
import { MarkdownPreview } from './MarkdownEditor'
import { Pencil, Trash2, Play, CheckCircle2, Clock, Circle, X, LayoutList, Columns3 } from 'lucide-react'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'Todo', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/20' }
}

const STATUS_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2
}

function TaskCard({ task, onEdit, onDelete, onStart, compact }: {
  task: TaskConfig
  onEdit: () => void
  onDelete: () => void
  onStart: () => void
  compact?: boolean
}) {
  const badge = STATUS_BADGE[task.status]
  const StatusIcon = STATUS_ICON[task.status]

  return (
    <div className="group bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 hover:border-white/[0.1] transition-colors">
      <div className="flex items-start gap-2">
        <StatusIcon size={14} className={`${badge.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-200 font-medium truncate">{task.title}</span>
            {task.assignedAgent && (
              <AgentIcon agentType={task.assignedAgent} size={14} />
            )}
          </div>
          {!compact && (
            <div className="mt-1.5">
              <MarkdownPreview content={task.description} className="line-clamp-3" />
            </div>
          )}
          {compact && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {task.status === 'todo' && (
            <button
              onClick={onStart}
              className="p-1 text-gray-600 hover:text-green-400 rounded transition-colors"
              title="Start task now"
            >
              <Play size={12} strokeWidth={2} />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1 text-gray-600 hover:text-white rounded transition-colors"
            title="Edit task"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
            title="Delete task"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

const KANBAN_COLUMNS: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'todo', title: 'Todo', color: 'border-gray-500/30' },
  { status: 'in_progress', title: 'In Progress', color: 'border-blue-500/30' },
  { status: 'done', title: 'Done', color: 'border-green-500/30' }
]

function KanbanBoard({ allTasks, onEdit, onDelete, onStart, onDrop }: {
  allTasks: TaskConfig[]
  onEdit: (task: TaskConfig) => void
  onDelete: (id: string) => void
  onStart: (task: TaskConfig) => void
  onDrop: (taskId: string, newStatus: TaskStatus) => void
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
            className={`flex-1 min-w-[200px] flex flex-col rounded-lg border transition-colors ${
              isDragOver ? 'border-white/[0.15] bg-white/[0.02]' : 'border-white/[0.06]'
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

function ListView({ sections, onEdit, onDelete, onStart }: {
  sections: { title: string; tasks: TaskConfig[]; emptyText: string }[]
  onEdit: (task: TaskConfig) => void
  onDelete: (id: string) => void
  onStart: (task: TaskConfig) => void
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
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function TaskQueuePanel() {
  const isOpen = useAppStore((s) => s.isTaskPanelOpen)
  const setOpen = useAppStore((s) => s.setTaskPanelOpen)
  const activeProject = useAppStore((s) => s.activeProject)
  const config = useAppStore((s) => s.config)
  const removeTask = useAppStore((s) => s.removeTask)
  const setEditingTask = useAppStore((s) => s.setEditingTask)
  const setTaskDialogOpen = useAppStore((s) => s.setTaskDialogOpen)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const startTask = useAppStore((s) => s.startTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const setConfig = useAppStore((s) => s.setConfig)

  const defaultView = config?.defaults.taskViewMode || 'list'
  const [viewMode, setViewMode] = useState<TaskViewMode>(defaultView)

  if (!isOpen || !activeProject) return null

  const allTasks = config?.tasks?.filter((t) => t.projectName === activeProject) || []
  const todoTasks = allTasks.filter((t) => t.status === 'todo').sort((a, b) => a.order - b.order)
  const inProgressTasks = allTasks.filter((t) => t.status === 'in_progress')
  const doneTasks = allTasks.filter((t) => t.status === 'done')

  const project = config?.projects.find((p) => p.name === activeProject)

  const handleStartTask = async (task: TaskConfig) => {
    if (!project) return
    const agentType = config?.defaults.defaultAgent || 'claude'
    const session = await window.api.createTerminal({
      agentType,
      projectName: project.name,
      projectPath: project.path,
      branch: task.branch,
      useWorktree: task.useWorktree,
      initialPrompt: task.description
    })
    addTerminal(session)
    startTask(task.id, session.id, agentType)
  }

  const handleEdit = (task: TaskConfig) => {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  const handleKanbanDrop = (taskId: string, newStatus: TaskStatus) => {
    const task = allTasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    if (newStatus === 'in_progress' && task.status === 'todo') {
      handleStartTask(task)
    } else if (newStatus === 'done') {
      updateTask(taskId, { status: 'done', completedAt: new Date().toISOString() })
    } else if (newStatus === 'todo') {
      updateTask(taskId, { status: 'todo', assignedSessionId: undefined, assignedAgent: undefined, completedAt: undefined })
    }
  }

  const sections = [
    { title: 'Todo', tasks: todoTasks, emptyText: 'No tasks in queue' },
    { title: 'In Progress', tasks: inProgressTasks, emptyText: 'No active tasks' },
    { title: 'Done', tasks: doneTasks, emptyText: 'No completed tasks' }
  ]

  const panelWidth = viewMode === 'kanban' ? 'w-[780px]' : 'w-[420px]'

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setOpen(false)}
      />
      <motion.div
        className={`fixed top-0 right-0 z-40 ${panelWidth} h-full border-l border-white/[0.08]
                   shadow-2xl flex flex-col overflow-hidden`}
        style={{ background: '#1a1a1e' }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-medium text-white">Task Queue</h2>
            <p className="text-xs text-gray-500 mt-0.5">{activeProject}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-white/[0.04] rounded-md p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-white/[0.1] text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="List view"
              >
                <LayoutList size={14} strokeWidth={2} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'kanban' ? 'bg-white/[0.1] text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                title="Kanban view"
              >
                <Columns3 size={14} strokeWidth={2} />
              </button>
            </div>
            <button
              onClick={() => {
                setEditingTask(null)
                setTaskDialogOpen(true)
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white
                         bg-white/[0.06] hover:bg-white/[0.1] rounded-md transition-colors"
            >
              + Add Task
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 text-gray-500 hover:text-white rounded-md transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {viewMode === 'kanban' ? (
            <KanbanBoard
              allTasks={allTasks}
              onEdit={handleEdit}
              onDelete={(id) => removeTask(id)}
              onStart={handleStartTask}
              onDrop={handleKanbanDrop}
            />
          ) : (
            <ListView
              sections={sections}
              onEdit={handleEdit}
              onDelete={(id) => removeTask(id)}
              onStart={handleStartTask}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
