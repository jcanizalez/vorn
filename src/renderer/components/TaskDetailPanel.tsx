import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../stores'
import { AgentType, GitDiffResult } from '../../shared/types'
import { MarkdownPreview, TASK_TEMPLATE } from './MarkdownEditor'
import { RichMarkdownEditor } from './rich-editor/RichMarkdownEditor'
import { AgentIcon } from './AgentIcon'
import { DiffFileList, DiffContent } from './DiffSidebar'
import { CommitDialog } from './CommitDialog'
import { STATUS_BADGE, STATUS_ICON } from './task-board/TaskCard'
import { toast } from './Toast'
import {
  X, Play, CheckCircle2, XCircle, RotateCcw, Terminal, Pencil, Trash2,
  GitBranch, Clock, Calendar, ImageIcon, ImagePlus, FileCode, RefreshCw, Loader2,
  GitCommitHorizontal, Send, MessageSquare, ChevronDown, ChevronRight, FolderGit2,
  Save, ArrowLeft
} from 'lucide-react'
import { ConfirmPopover } from './ConfirmPopover'

interface DiffComment {
  filePath: string
  lineIndex: number
  lineContent: string
  comment: string
}

function formatReviewFeedback(comments: DiffComment[]): string {
  const grouped = new Map<string, DiffComment[]>()
  for (const c of comments) {
    if (!grouped.has(c.filePath)) grouped.set(c.filePath, [])
    grouped.get(c.filePath)!.push(c)
  }

  let feedback = 'Please address the following review comments:\n\n'
  for (const [file, fileComments] of grouped) {
    feedback += `**${file}:**\n`
    for (const c of fileComments) {
      const codeLine = c.lineContent.slice(1).trim()
      feedback += `- Line \`${codeLine}\`: ${c.comment}\n`
    }
    feedback += '\n'
  }
  return feedback
}

export function TaskDetailPanel() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const isCreateMode = selectedTaskId === 'new'
  const task = useAppStore((s) =>
    selectedTaskId && selectedTaskId !== 'new'
      ? (s.config?.tasks || []).find((t) => t.id === selectedTaskId)
      : undefined
  )
  const config = useAppStore((s) => s.config)
  const activeProject = useAppStore((s) => s.activeProject)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const completeTask = useAppStore((s) => s.completeTask)
  const cancelTask = useAppStore((s) => s.cancelTask)
  const reopenTask = useAppStore((s) => s.reopenTask)
  const removeTask = useAppStore((s) => s.removeTask)
  const startTask = useAppStore((s) => s.startTask)
  const addTask = useAppStore((s) => s.addTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)
  const terminals = useAppStore((s) => s.terminals)

  const [isEditing, setIsEditing] = useState(false)
  const [panelWidth, setPanelWidth] = useState(420)
  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [comments, setComments] = useState<DiffComment[]>([])
  const [commentingLine, setCommentingLine] = useState<{ filePath: string; lineIndex: number; lineContent: string } | null>(null)
  const [showDiffSection, setShowDiffSection] = useState(true)
  const [taskImagePaths, setTaskImagePaths] = useState<Map<string, string>>(new Map())

  // Form state (edit/create modes)
  const [formTitle, setFormTitle] = useState('')
  const [formProjectName, setFormProjectName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formBranch, setFormBranch] = useState('')
  const [formUseWorktree, setFormUseWorktree] = useState(false)
  const [formImages, setFormImages] = useState<string[]>([])
  const [formImagePaths, setFormImagePaths] = useState<Map<string, string>>(new Map())
  const newTaskIdRef = useRef<string>(crypto.randomUUID())

  const inEditOrCreate = isEditing || isCreateMode
  const taskId = isCreateMode ? newTaskIdRef.current : task?.id

  const project = config?.projects.find((p) => p.name === (inEditOrCreate ? formProjectName : task?.projectName))
  const cwd = task?.worktreePath || project?.path || ''
  const showDiff = !inEditOrCreate && (task?.status === 'in_review' || task?.status === 'in_progress')
  const sessionIsLive = !!(task?.assignedSessionId && terminals.has(task.assignedSessionId))
  const canResume = !sessionIsLive && !!task?.agentSessionId && !!task?.assignedAgent

  // Initialize form when entering edit mode
  useEffect(() => {
    if (isEditing && task) {
      setFormTitle(task.title)
      setFormProjectName(task.projectName)
      setFormDescription(task.description)
      setFormBranch(task.branch || '')
      setFormUseWorktree(task.useWorktree || false)
      setFormImages(task.images || [])
      if (task.images?.length) {
        Promise.all(
          task.images.map(async (f) => {
            const p = await window.api.getTaskImagePath(task.id, f)
            return [f, p] as [string, string]
          })
        ).then((pairs) => setFormImagePaths(new Map(pairs)))
      } else {
        setFormImagePaths(new Map())
      }
    }
  }, [isEditing, task])

  // Initialize form for create mode
  useEffect(() => {
    if (isCreateMode) {
      newTaskIdRef.current = crypto.randomUUID()
      setFormTitle('')
      setFormProjectName(activeProject || config?.projects[0]?.name || '')
      setFormDescription(TASK_TEMPLATE)
      setFormBranch('')
      setFormUseWorktree(false)
      setFormImages([])
      setFormImagePaths(new Map())
      setIsEditing(false)
    }
  }, [isCreateMode, activeProject, config])

  // Reset editing state when switching tasks
  useEffect(() => {
    setIsEditing(false)
  }, [selectedTaskId])

  // Fetch diff for review tasks
  const fetchDiff = useCallback(async () => {
    if (!cwd || !showDiff) return
    setDiffLoading(true)
    try {
      const result = await window.api.getGitDiffFull(cwd)
      setDiffResult(result)
      setSelectedFile(null)
      setComments([])
      setCommentingLine(null)
    } finally {
      setDiffLoading(false)
    }
  }, [cwd, showDiff])

  useEffect(() => {
    if (selectedTaskId && selectedTaskId !== 'new' && cwd && showDiff) {
      fetchDiff()
    } else {
      setDiffResult(null)
      setSelectedFile(null)
      setComments([])
      setCommentingLine(null)
    }
  }, [selectedTaskId, cwd, showDiff, fetchDiff])

  // Load task images (view mode)
  useEffect(() => {
    if (!task?.images?.length || !selectedTaskId || selectedTaskId === 'new') return
    const loadImages = async () => {
      const paths = new Map<string, string>()
      for (const filename of task.images!) {
        try {
          const path = await window.api.getTaskImagePath(selectedTaskId, filename)
          paths.set(filename, path)
        } catch { /* ignore */ }
      }
      setTaskImagePaths(paths)
    }
    loadImages()
  }, [selectedTaskId, task?.images])

  if (!task && !isCreateMode) return null

  const badge = task ? STATUS_BADGE[task.status] : null
  const StatusIcon = task ? STATUS_ICON[task.status] : null

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = panelWidth
    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      setPanelWidth(Math.max(320, Math.min(600, startWidth + delta)))
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const handleStartTask = async () => {
    if (!project || !task) return
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

  const handleFocusSession = () => {
    if (task?.assignedSessionId) setFocusedTerminal(task.assignedSessionId)
  }

  const handleResumeSession = async () => {
    if (!task?.agentSessionId || !task?.assignedAgent || !project) return
    const session = await window.api.createTerminal({
      agentType: task.assignedAgent,
      projectName: task.projectName,
      projectPath: project.path,
      branch: task.branch,
      useWorktree: task.useWorktree,
      resumeSessionId: task.agentSessionId
    })
    addTerminal(session)
    if (task.status === 'in_progress') {
      startTask(task.id, session.id, task.assignedAgent as AgentType)
    }
    setFocusedTerminal(session.id)
  }

  const handleClickLine = (filePath: string, lineIndex: number, lineContent: string) => {
    if (commentingLine?.filePath === filePath && commentingLine?.lineIndex === lineIndex) {
      setCommentingLine(null)
    } else {
      setCommentingLine({ filePath, lineIndex, lineContent })
    }
  }

  const handleAddComment = (text: string) => {
    if (!commentingLine) return
    setComments((prev) => [...prev, {
      filePath: commentingLine.filePath,
      lineIndex: commentingLine.lineIndex,
      lineContent: commentingLine.lineContent,
      comment: text
    }])
    setCommentingLine(null)
  }

  const handleSendFeedback = async () => {
    if (comments.length === 0 || !task) return
    const feedback = formatReviewFeedback(comments)

    if (task.agentSessionId && task.assignedAgent && project) {
      const session = await window.api.createTerminal({
        agentType: task.assignedAgent,
        projectName: task.projectName,
        projectPath: project.path,
        branch: task.branch,
        useWorktree: task.useWorktree,
        resumeSessionId: task.agentSessionId,
        initialPrompt: feedback
      })
      addTerminal(session)
      startTask(task.id, session.id, task.assignedAgent, session.worktreePath)
      setFocusedTerminal(session.id)
      toast.success('Feedback sent to agent')
    } else {
      await navigator.clipboard.writeText(feedback)
      toast.info('Review feedback copied to clipboard')
    }
    setComments([])
    setCommentingLine(null)
  }

  // Image handlers for edit/create modes
  const handleAddImages = async () => {
    if (!taskId) return
    const filePaths = await window.api.openImageDialog()
    if (!filePaths) return

    const newImages = [...formImages]
    const newPaths = new Map(formImagePaths)

    for (const sourcePath of filePaths) {
      const filename = await window.api.saveTaskImage(taskId, sourcePath)
      newImages.push(filename)
      const absPath = await window.api.getTaskImagePath(taskId, filename)
      newPaths.set(filename, absPath)
    }

    setFormImages(newImages)
    setFormImagePaths(newPaths)
  }

  const handleRemoveImage = async (filename: string) => {
    if (!taskId) return
    await window.api.deleteTaskImage(taskId, filename)
    setFormImages((prev) => prev.filter((f) => f !== filename))
    setFormImagePaths((prev) => {
      const next = new Map(prev)
      next.delete(filename)
      return next
    })
  }

  const handleDrop = async (e: React.DragEvent) => {
    if (!inEditOrCreate || !taskId) return
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.name)
    )
    if (!files.length) return

    const newImages = [...formImages]
    const newPaths = new Map(formImagePaths)

    for (const file of files) {
      const filename = await window.api.saveTaskImage(taskId, file.path)
      newImages.push(filename)
      const absPath = await window.api.getTaskImagePath(taskId, filename)
      newPaths.set(filename, absPath)
    }

    setFormImages(newImages)
    setFormImagePaths(newPaths)
  }

  const handleSave = () => {
    if (!formTitle.trim() || !formProjectName || !formDescription.trim()) return

    const now = new Date().toISOString()
    if (isCreateMode) {
      const existingTasks = config?.tasks?.filter((t) => t.projectName === formProjectName && t.status === 'todo') || []
      const newId = newTaskIdRef.current
      addTask({
        id: newId,
        projectName: formProjectName,
        title: formTitle.trim(),
        description: formDescription.trim(),
        status: 'todo',
        order: existingTasks.length,
        branch: formBranch.trim() || undefined,
        useWorktree: formUseWorktree || undefined,
        images: formImages.length > 0 ? formImages : undefined,
        createdAt: now,
        updatedAt: now
      })
      toast.success('Task created')
      setSelectedTaskId(newId)
    } else if (task) {
      updateTask(task.id, {
        title: formTitle.trim(),
        projectName: formProjectName,
        description: formDescription.trim(),
        branch: formBranch.trim() || undefined,
        useWorktree: formUseWorktree || undefined,
        images: formImages.length > 0 ? formImages : undefined
      })
      toast.success('Task updated')
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    if (isCreateMode) {
      setSelectedTaskId(null)
    } else {
      setIsEditing(false)
    }
  }

  const canSubmit = formTitle.trim() && formProjectName && formDescription.trim()

  const stat = diffResult ? {
    filesChanged: diffResult.files.length,
    insertions: diffResult.files.reduce((s, f) => s + f.insertions, 0),
    deletions: diffResult.files.reduce((s, f) => s + f.deletions, 0)
  } : null

  const hasChanges = stat && (stat.insertions > 0 || stat.deletions > 0)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className="shrink-0 flex flex-col border-l border-white/[0.08] overflow-hidden"
      style={{ width: panelWidth, background: '#141416' }}
      onDragOver={inEditOrCreate ? (e) => e.preventDefault() : undefined}
      onDrop={inEditOrCreate ? handleDrop : undefined}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors z-10"
        style={{ position: 'relative', width: 2, minWidth: 2 }}
        onPointerDown={handleResizeStart}
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
        {inEditOrCreate ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelEdit}
              className="p-1 text-gray-500 hover:text-white rounded transition-colors"
              title="Back"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
            </button>
            <h3 className="text-[14px] font-medium text-gray-100">
              {isCreateMode ? 'New Task' : 'Edit Task'}
            </h3>
            <div className="flex-1" />
            <button
              onClick={() => setSelectedTaskId(null)}
              className="p-1 text-gray-500 hover:text-white rounded transition-colors"
              title="Close"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ) : task && badge && StatusIcon ? (
          <div className="flex items-start gap-2">
            <StatusIcon size={16} className={`${badge.color} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-medium text-gray-100 leading-tight">{task.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] px-1.5 py-0.5 rounded ${badge.bg} ${badge.color}`}>
                  {badge.label}
                </span>
                {task.assignedAgent && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <AgentIcon agentType={task.assignedAgent} size={12} />
                    {task.assignedAgent}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-gray-500 hover:text-white rounded transition-colors"
                title="Edit task"
              >
                <Pencil size={13} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="p-1 text-gray-500 hover:text-white rounded transition-colors"
                title="Close"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {inEditOrCreate ? (
          /* ── Edit / Create Form ────────────────────────── */
          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Title
              </label>
              <input
                type="text"
                placeholder="Fix authentication bug"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                           text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none"
              />
            </div>

            {/* Project */}
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Project
              </label>
              <select
                value={formProjectName}
                onChange={(e) => setFormProjectName(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                           text-gray-200 focus:border-white/[0.15] focus:outline-none"
              >
                <option value="">Select project</option>
                {config?.projects.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                Description
              </label>
              <p className="text-[11px] text-gray-600 mb-1.5">
                This will be sent as the prompt to the coding agent.
              </p>
              <RichMarkdownEditor
                value={formDescription}
                onChange={setFormDescription}
                placeholder="Describe the task in detail, or type / for commands..."
              />
            </div>

            {/* Images */}
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Images
                <span className="text-gray-600 normal-case tracking-normal ml-1">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {formImages.map((filename) => {
                  const absPath = formImagePaths.get(filename)
                  return (
                    <div key={filename} className="relative group/img w-16 h-16 rounded-lg border border-white/[0.08] overflow-hidden bg-white/[0.03]">
                      {absPath && (
                        <img
                          src={`file://${absPath}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => handleRemoveImage(filename)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center
                                   opacity-0 group-hover/img:opacity-100 transition-opacity text-white hover:text-red-400"
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={handleAddImages}
                  className="w-16 h-16 rounded-lg border border-dashed border-white/[0.1] flex items-center justify-center
                             text-gray-600 hover:text-gray-400 hover:border-white/[0.2] transition-colors"
                  title="Add images"
                >
                  <ImagePlus size={18} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Branch & Worktree */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Branch
                  <span className="text-gray-600 normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="feature/my-task"
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                             text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none"
                />
              </div>
              <button
                onClick={() => setFormUseWorktree(!formUseWorktree)}
                className={`p-2.5 rounded-lg border transition-all shrink-0 ${
                  formUseWorktree
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-white/[0.06] text-gray-600 hover:text-gray-400'
                }`}
                title={formUseWorktree ? 'Worktree enabled' : 'Enable worktree isolation'}
              >
                <FolderGit2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : task ? (
          /* ── View Mode ─────────────────────────────────── */
          <>
            {/* Actions */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex flex-wrap gap-2">
              {task.status === 'todo' && (
                <button
                  onClick={handleStartTask}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-green-500/10 hover:bg-green-500/20 border border-green-500/20
                             rounded-md transition-colors text-green-400 hover:text-green-300"
                >
                  <Play size={12} strokeWidth={2} />
                  Start Task
                </button>
              )}
              {sessionIsLive && (
                <button
                  onClick={handleFocusSession}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20
                             rounded-md transition-colors text-violet-400 hover:text-violet-300"
                >
                  <Terminal size={12} strokeWidth={2} />
                  Focus Session
                </button>
              )}
              {canResume && (
                <button
                  onClick={handleResumeSession}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20
                             rounded-md transition-colors text-amber-400 hover:text-amber-300"
                >
                  <Play size={12} strokeWidth={2} />
                  Resume Session
                </button>
              )}
              {(task.status === 'in_review' || task.status === 'in_progress') && (
                <button
                  onClick={() => { completeTask(task.id); toast.success('Task completed') }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                             rounded-md transition-colors text-gray-300 hover:text-gray-100"
                >
                  <CheckCircle2 size={12} strokeWidth={2} />
                  Done
                </button>
              )}
              {task.status !== 'cancelled' && task.status !== 'done' && (
                <button
                  onClick={() => { cancelTask(task.id); toast.info('Task cancelled') }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                             rounded-md transition-colors text-gray-400 hover:text-gray-200"
                >
                  <XCircle size={12} strokeWidth={2} />
                  Cancel
                </button>
              )}
              {(task.status === 'cancelled' || task.status === 'done') && (
                <button
                  onClick={() => { reopenTask(task.id); toast.success('Task reopened') }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                             rounded-md transition-colors text-gray-300 hover:text-gray-100"
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  Reopen
                </button>
              )}
              <ConfirmPopover
                message="Delete this task permanently?"
                confirmLabel="Delete"
                onConfirm={() => {
                  removeTask(task.id)
                  setSelectedTaskId(null)
                  toast.success('Task deleted')
                }}
              >
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium
                             bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.06]
                             rounded-md transition-colors text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={12} strokeWidth={2} />
                  Delete
                </button>
              </ConfirmPopover>
            </div>

            {/* Metadata */}
            <div className="px-4 py-3 border-b border-white/[0.06] space-y-2">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-gray-600 w-16">Project</span>
                <span className="text-gray-300">{task.projectName}</span>
              </div>
              {task.branch && (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-gray-600 w-16">Branch</span>
                  <span className="flex items-center gap-1 text-gray-300">
                    <GitBranch size={11} strokeWidth={2} />
                    {task.branch}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-gray-600 w-16">Created</span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Calendar size={11} strokeWidth={2} />
                  {formatDate(task.createdAt)}
                </span>
              </div>
              {task.completedAt && (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-gray-600 w-16">Completed</span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <Clock size={11} strokeWidth={2} />
                    {formatDate(task.completedAt)}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 block">Description</span>
                <MarkdownPreview content={task.description} />
              </div>
            )}

            {/* Images */}
            {task.images && task.images.length > 0 && (
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                  <ImageIcon size={11} strokeWidth={2} className="inline mr-1" />
                  Attachments ({task.images.length})
                </span>
                <div className="space-y-2">
                  {task.images.map((filename) => {
                    const path = taskImagePaths.get(filename)
                    return path ? (
                      <img
                        key={filename}
                        src={`file://${path}`}
                        alt={filename}
                        className="rounded-md border border-white/[0.06] max-w-full"
                      />
                    ) : (
                      <div key={filename} className="text-xs text-gray-600 py-1">{filename}</div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Diff review section */}
            {showDiff && (
              <div className="border-b border-white/[0.06]">
                <button
                  onClick={() => setShowDiffSection(!showDiffSection)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-[11px] font-medium text-gray-500
                             uppercase tracking-wider hover:text-gray-300 transition-colors"
                >
                  {showDiffSection ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <FileCode size={12} strokeWidth={2} />
                  Changes
                  {stat && (
                    <span className="flex items-center gap-1.5 font-mono normal-case">
                      <span className="text-green-400">+{stat.insertions}</span>
                      <span className="text-red-400">-{stat.deletions}</span>
                    </span>
                  )}
                  <div className="flex-1" />
                  {hasChanges && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setShowCommitDialog(true) }}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium normal-case
                                 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                                 rounded transition-colors text-gray-400 hover:text-gray-200"
                    >
                      <GitCommitHorizontal size={11} strokeWidth={1.5} />
                      Commit
                    </span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); fetchDiff() }}
                    className="p-0.5 text-gray-500 hover:text-white rounded transition-colors"
                  >
                    <RefreshCw size={12} className={diffLoading ? 'animate-spin' : ''} strokeWidth={1.5} />
                  </span>
                </button>

                {showDiffSection && (
                  <>
                    {/* Review feedback bar */}
                    {comments.length > 0 && (
                      <div className="px-3 py-2 border-t border-purple-500/15 bg-purple-500/[0.05] flex items-center gap-2">
                        <MessageSquare size={13} className="text-purple-400 shrink-0" />
                        <span className="text-[12px] text-purple-300 flex-1">
                          {comments.length} comment{comments.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => setComments([])}
                          className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleSendFeedback}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium
                                     bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20
                                     rounded-md transition-colors text-purple-300 hover:text-purple-200"
                        >
                          <Send size={11} strokeWidth={2} />
                          {task.agentSessionId ? 'Send to Agent' : 'Copy Feedback'}
                        </button>
                      </div>
                    )}

                    {diffLoading && !diffResult ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={18} className="text-gray-500 animate-spin" />
                      </div>
                    ) : diffResult && diffResult.files.length > 0 ? (
                      <>
                        <DiffFileList
                          files={diffResult.files}
                          selectedFile={selectedFile}
                          onSelectFile={setSelectedFile}
                        />
                        <DiffContent
                          files={diffResult.files}
                          selectedFile={selectedFile}
                          comments={comments}
                          commentingLine={commentingLine}
                          onClickLine={handleClickLine}
                          onAddComment={handleAddComment}
                          onCancelComment={() => setCommentingLine(null)}
                          onRemoveComment={(idx) => setComments((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      </>
                    ) : (
                      <div className="text-center py-6 text-xs text-gray-600">
                        {cwd ? 'No uncommitted changes' : 'No project path'}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Save/Cancel footer for edit/create modes */}
      {inEditOrCreate && (
        <div className="px-4 py-3 border-t border-white/[0.06] flex justify-end gap-2 shrink-0">
          <button
            onClick={handleCancelEdit}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200
                       bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white
                       bg-white/[0.1] hover:bg-white/[0.15]
                       disabled:opacity-30 disabled:cursor-not-allowed
                       rounded-lg transition-colors"
          >
            <Save size={13} strokeWidth={2} />
            {isCreateMode ? 'Create Task' : 'Save'}
          </button>
        </div>
      )}

      {showCommitDialog && (
        <CommitDialog
          cwd={cwd}
          branch={task?.branch}
          stat={stat ?? undefined}
          onClose={() => setShowCommitDialog(false)}
          onCommitted={() => {
            fetchDiff()
            setShowCommitDialog(false)
          }}
        />
      )}
    </div>
  )
}
