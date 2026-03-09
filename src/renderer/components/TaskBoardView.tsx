import { useAppStore } from '../stores'
import { TaskConfig, TaskStatus } from '../../shared/types'
import { TaskKanbanBoard } from './task-board/TaskKanbanBoard'
import { TaskListView } from './task-board/TaskListView'
import { ListTodo } from 'lucide-react'
import { toast } from './Toast'

export function TaskBoardView() {
  const activeProject = useAppStore((s) => s.activeProject)
  const config = useAppStore((s) => s.config)
  const removeTask = useAppStore((s) => s.removeTask)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const startTask = useAppStore((s) => s.startTask)
  const completeTask = useAppStore((s) => s.completeTask)
  const cancelTask = useAppStore((s) => s.cancelTask)
  const reopenTask = useAppStore((s) => s.reopenTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const terminals = useAppStore((s) => s.terminals)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const taskStatusFilter = useAppStore((s) => s.taskStatusFilter)

  const viewMode = config?.defaults?.taskViewMode ?? 'list'

  const projectTasks = (config?.tasks || []).filter(
    (t) => !activeProject || t.projectName === activeProject
  )

  // Apply status filter
  const allTasks = taskStatusFilter === 'all'
    ? projectTasks
    : projectTasks.filter((t) => t.status === taskStatusFilter)

  const todoTasks = allTasks.filter((t) => t.status === 'todo').sort((a, b) => a.order - b.order)
  const inProgressTasks = allTasks.filter((t) => t.status === 'in_progress')
  const inReviewTasks = allTasks.filter((t) => t.status === 'in_review')
  const doneTasks = allTasks.filter((t) => t.status === 'done')
  const cancelledTasks = allTasks.filter((t) => t.status === 'cancelled')

  const handleStartTask = async (task: TaskConfig) => {
    const project = config?.projects.find((p) => p.name === task.projectName)
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
    startTask(task.id, session.id, agentType, session.worktreePath)
  }

  const handleEdit = (task: TaskConfig) => {
    setSelectedTaskId(task.id)
  }

  const getOpenSessionHandler = (task: TaskConfig) => {
    if (task.assignedSessionId && terminals.has(task.assignedSessionId)) {
      return () => setFocusedTerminal(task.assignedSessionId!)
    }
    if (task.agentSessionId && task.assignedAgent && (task.status === 'in_progress' || task.status === 'in_review' || task.status === 'done')) {
      return async () => {
        const project = config?.projects.find((p) => p.name === task.projectName)
        const agentType = task.assignedAgent!
        const session = await window.api.createTerminal({
          agentType,
          projectName: task.projectName,
          projectPath: project?.path || '',
          branch: task.branch,
          useWorktree: task.useWorktree,
          resumeSessionId: task.agentSessionId
        })
        addTerminal(session)
        if (task.status === 'in_progress') {
          startTask(task.id, session.id, agentType)
        }
        setFocusedTerminal(session.id)
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

  const isSessionLive = (task: TaskConfig) =>
    !!(task.assignedSessionId && terminals.has(task.assignedSessionId))

  const handleSelect = (task: TaskConfig) => {
    setSelectedTaskId(task.id)
  }

  const sections = [
    { title: 'Todo', tasks: todoTasks, emptyText: 'No tasks in queue' },
    { title: 'In Progress', tasks: inProgressTasks, emptyText: 'No active tasks' },
    { title: 'In Review', tasks: inReviewTasks, emptyText: 'No tasks awaiting review' },
    { title: 'Done', tasks: doneTasks, emptyText: 'No completed tasks' },
    { title: 'Cancelled', tasks: cancelledTasks, emptyText: 'No cancelled tasks' }
  ]

  const totalTasks = allTasks.length

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {totalTasks === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ListTodo size={40} strokeWidth={1} className="text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 mb-1">
              {taskStatusFilter !== 'all' ? 'No matching tasks' : 'No tasks yet'}
            </p>
            <p className="text-xs text-gray-600">
              {taskStatusFilter !== 'all'
                ? 'Try changing the status filter'
                : activeProject
                  ? `Create a task for ${activeProject} to get started`
                  : 'Select a project or create a task to get started'}
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          <TaskKanbanBoard
            allTasks={allTasks}
            onEdit={handleEdit}
            onDelete={(id) => { removeTask(id); toast.success('Task deleted') }}
            onStart={handleStartTask}
            onDrop={handleKanbanDrop}
            onOpenSession={getOpenSessionHandler}
            onComplete={(id) => { completeTask(id); toast.success('Task completed') }}
            onCancel={(id) => { cancelTask(id); toast.info('Task cancelled') }}
            onReopen={(id) => { reopenTask(id); toast.success('Task reopened') }}
            onReviewDiff={(id) => setSelectedTaskId(id)}
            onSelect={handleSelect}
            isSessionLive={isSessionLive}
          />
        ) : (
          <TaskListView
            sections={sections}
            onEdit={handleEdit}
            onDelete={(id) => { removeTask(id); toast.success('Task deleted') }}
            onStart={handleStartTask}
            onOpenSession={getOpenSessionHandler}
            onComplete={(id) => { completeTask(id); toast.success('Task completed') }}
            onCancel={(id) => { cancelTask(id); toast.info('Task cancelled') }}
            onReopen={(id) => { reopenTask(id); toast.success('Task reopened') }}
            onReviewDiff={(id) => setSelectedTaskId(id)}
            onSelect={handleSelect}
            isSessionLive={isSessionLive}
          />
        )}
      </div>
    </div>
  )
}
