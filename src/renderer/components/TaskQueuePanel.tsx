import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import {
  TaskConfig,
  TaskStatus,
  TaskViewMode,
  supportsExactSessionResume
} from '../../shared/types'
import { buildTaskPrompt } from '../../shared/prompt-builder'
import { AgentIcon } from './AgentIcon'
import { MarkdownPreview } from './MarkdownEditor'
import {
  Pencil,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Circle,
  X,
  LayoutList,
  Columns3,
  Terminal,
  Eye,
  XCircle,
  RotateCcw,
  FileCode,
  ImageIcon
} from 'lucide-react'
import { ConfirmPopover } from './ConfirmPopover'
import { toast } from './Toast'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  todo: { label: 'Todo', color: 'text-gray-400', bg: 'bg-gray-500/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  in_review: { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-500/20' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-gray-500/10' }
}

const STATUS_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  todo: Circle,
  in_progress: Clock,
  in_review: Eye,
  done: CheckCircle2,
  cancelled: XCircle
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onStart,
  onOpenSession,
  onComplete,
  onCancel,
  onReopen,
  onReviewDiff,
  sessionIsLive,
  compact
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
  sessionIsLive?: boolean
  compact?: boolean
}) {
  const badge = STATUS_BADGE[task.status]
  const StatusIcon = STATUS_ICON[task.status]

  return (
    <div
      className={`group bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 hover:border-white/[0.1] transition-colors
                     ${task.status === 'cancelled' ? 'opacity-60' : ''}`}
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
          {!compact && (
            <div className="mt-1.5">
              <MarkdownPreview content={task.description} className="line-clamp-3" />
            </div>
          )}
          {compact && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
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

const KANBAN_COLUMNS: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'todo', title: 'Todo', color: 'border-gray-500/30' },
  { status: 'in_progress', title: 'In Progress', color: 'border-blue-500/30' },
  { status: 'in_review', title: 'In Review', color: 'border-purple-500/30' },
  { status: 'done', title: 'Done', color: 'border-green-500/30' },
  { status: 'cancelled', title: 'Cancelled', color: 'border-gray-500/20' }
]

function KanbanBoard({
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

function ListView({
  sections,
  onEdit,
  onDelete,
  onStart,
  onOpenSession,
  onComplete,
  onCancel,
  onReopen,
  onReviewDiff,
  isSessionLive
}: {
  sections: { title: string; tasks: TaskConfig[]; emptyText: string }[]
  onEdit: (task: TaskConfig) => void
  onDelete: (id: string) => void
  onStart: (task: TaskConfig) => void
  onOpenSession: (task: TaskConfig) => (() => void) | undefined
  onComplete: (id: string) => void
  onCancel: (id: string) => void
  onReopen: (id: string) => void
  onReviewDiff: (id: string) => void
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

export function TaskQueuePanel() {
  const isOpen = useAppStore((s) => s.isTaskPanelOpen)
  const setOpen = useAppStore((s) => s.setTaskPanelOpen)
  const activeProject = useAppStore((s) => s.activeProject)
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const config = useAppStore((s) => s.config)
  const configProjects = useAppStore((s) => s.config?.projects)
  const removeTask = useAppStore((s) => s.removeTask)
  const setEditingTask = useAppStore((s) => s.setEditingTask)
  const setTaskDialogOpen = useAppStore((s) => s.setTaskDialogOpen)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const startTask = useAppStore((s) => s.startTask)
  const completeTask = useAppStore((s) => s.completeTask)
  const cancelTask = useAppStore((s) => s.cancelTask)
  const reopenTask = useAppStore((s) => s.reopenTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const terminals = useAppStore((s) => s.terminals)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)
  const setDiffReviewTaskId = useAppStore((s) => s.setDiffReviewTaskId)

  const defaultView = config?.defaults.taskViewMode || 'list'
  const [viewMode, setViewMode] = useState<TaskViewMode>(defaultView)

  const workspaceProjectNames = useMemo(() => {
    if (!configProjects) return new Set<string>()
    return new Set(
      configProjects
        .filter((p) => (p.workspaceId ?? 'personal') === activeWorkspace)
        .map((p) => p.name)
    )
  }, [configProjects, activeWorkspace])

  if (!isOpen) return null

  const allTasks = (config?.tasks ?? []).filter((t) =>
    activeProject ? t.projectName === activeProject : workspaceProjectNames.has(t.projectName)
  )
  const todoTasks = allTasks.filter((t) => t.status === 'todo').sort((a, b) => a.order - b.order)
  const inProgressTasks = allTasks.filter((t) => t.status === 'in_progress')
  const inReviewTasks = allTasks.filter((t) => t.status === 'in_review')
  const doneTasks = allTasks.filter((t) => t.status === 'done')
  const cancelledTasks = allTasks.filter((t) => t.status === 'cancelled')

  const project = config?.projects.find((p) => p.name === activeProject)

  const handleStartTask = async (task: TaskConfig) => {
    const taskProject = project ?? config?.projects.find((p) => p.name === task.projectName)
    if (!taskProject) return
    const agentType = config?.defaults.defaultAgent || 'claude'
    const siblingTasks = (config?.tasks || []).filter((t) => t.projectName === task.projectName)
    const session = await window.api.createTerminal({
      agentType,
      projectName: taskProject.name,
      projectPath: taskProject.path,
      branch: task.branch,
      useWorktree: task.useWorktree,
      initialPrompt: buildTaskPrompt({ task, project: taskProject, siblingTasks }),
      taskId: task.id
    })
    addTerminal(session)
    startTask(task.id, session.id, agentType, session.worktreePath)
  }

  const handleEdit = (task: TaskConfig) => {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  const getOpenSessionHandler = (task: TaskConfig) => {
    // Session still open — focus it
    if (task.assignedSessionId && terminals.has(task.assignedSessionId)) {
      return () => {
        setFocusedTerminal(task.assignedSessionId!)
        setOpen(false)
      }
    }
    // Session closed but agent session ID available — resume
    if (
      task.agentSessionId &&
      task.assignedAgent &&
      supportsExactSessionResume(task.assignedAgent) &&
      (task.status === 'in_progress' || task.status === 'in_review' || task.status === 'done')
    ) {
      return async () => {
        const agentType = task.assignedAgent!
        const taskProject = project ?? config?.projects.find((p) => p.name === task.projectName)
        if (!taskProject) return
        const session = await window.api.createTerminal({
          agentType,
          projectName: task.projectName,
          projectPath: taskProject.path,
          branch: task.branch,
          useWorktree: task.useWorktree,
          resumeSessionId: task.agentSessionId
        })
        addTerminal(session)
        if (task.status === 'in_progress') {
          startTask(task.id, session.id, agentType)
        }
        setFocusedTerminal(session.id)
        setOpen(false)
      }
    }
    return undefined
  }

  const handleKanbanDrop = (taskId: string, newStatus: TaskStatus) => {
    const task = allTasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    if (newStatus === 'in_progress' && task.status === 'todo') {
      handleStartTask(task)
    } else if (newStatus === 'in_review') {
      updateTask(taskId, { status: 'in_review', assignedSessionId: undefined })
    } else if (newStatus === 'done') {
      completeTask(taskId)
      toast.success('Task completed')
    } else if (newStatus === 'cancelled') {
      cancelTask(taskId)
      toast.info('Task cancelled')
    } else if (newStatus === 'todo') {
      reopenTask(taskId)
    }
  }

  const sections = [
    { title: 'Todo', tasks: todoTasks, emptyText: 'No tasks in queue' },
    { title: 'In Progress', tasks: inProgressTasks, emptyText: 'No active tasks' },
    { title: 'In Review', tasks: inReviewTasks, emptyText: 'No tasks awaiting review' },
    { title: 'Done', tasks: doneTasks, emptyText: 'No completed tasks' },
    { title: 'Cancelled', tasks: cancelledTasks, emptyText: 'No cancelled tasks' }
  ]

  const isSessionLive = (task: TaskConfig) =>
    !!(task.assignedSessionId && terminals.has(task.assignedSessionId))

  const panelWidth = viewMode === 'kanban' ? 'w-[90vw] max-w-[1100px]' : 'w-[420px]'

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
                  viewMode === 'list'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title="List view"
              >
                <LayoutList size={14} strokeWidth={2} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
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
              onDelete={(id) => {
                removeTask(id)
                toast.success('Task deleted')
              }}
              onStart={handleStartTask}
              onDrop={handleKanbanDrop}
              onOpenSession={getOpenSessionHandler}
              onComplete={(id) => {
                completeTask(id)
                toast.success('Task completed')
              }}
              onCancel={(id) => {
                cancelTask(id)
                toast.info('Task cancelled')
              }}
              onReopen={(id) => {
                reopenTask(id)
                toast.success('Task reopened')
              }}
              onReviewDiff={(id) => setDiffReviewTaskId(id)}
              isSessionLive={isSessionLive}
            />
          ) : (
            <ListView
              sections={sections}
              onEdit={handleEdit}
              onDelete={(id) => {
                removeTask(id)
                toast.success('Task deleted')
              }}
              onStart={handleStartTask}
              onOpenSession={getOpenSessionHandler}
              onComplete={(id) => {
                completeTask(id)
                toast.success('Task completed')
              }}
              onCancel={(id) => {
                cancelTask(id)
                toast.info('Task cancelled')
              }}
              onReopen={(id) => {
                reopenTask(id)
                toast.success('Task reopened')
              }}
              onReviewDiff={(id) => setDiffReviewTaskId(id)}
              isSessionLive={isSessionLive}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
