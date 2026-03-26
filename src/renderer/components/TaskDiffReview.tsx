import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { GitDiffResult, supportsExactSessionResume } from '../../shared/types'
import { DiffFileList, DiffContent } from './DiffSidebar'
import { CommitDialog } from './CommitDialog'
import { toast } from './Toast'
import { buildFeedbackPrompt } from '../../shared/prompt-builder'
import {
  X,
  RefreshCw,
  Loader2,
  GitCommitHorizontal,
  CheckCircle2,
  Send,
  MessageSquare
} from 'lucide-react'

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

export function TaskDiffReview() {
  const taskId = useAppStore((s) => s.diffReviewTaskId)
  const task = useAppStore((s) =>
    taskId ? (s.config?.tasks || []).find((t) => t.id === taskId) : undefined
  )
  const config = useAppStore((s) => s.config)
  const setDiffReviewTaskId = useAppStore((s) => s.setDiffReviewTaskId)
  const completeTask = useAppStore((s) => s.completeTask)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const startTask = useAppStore((s) => s.startTask)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)

  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(520)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [comments, setComments] = useState<DiffComment[]>([])
  const [commentingLine, setCommentingLine] = useState<{
    filePath: string
    lineIndex: number
    lineContent: string
  } | null>(null)

  const project = config?.projects.find((p) => p.name === task?.projectName)
  const cwd = task?.worktreePath || project?.path || ''

  const fetchDiff = useCallback(async () => {
    if (!cwd) return
    setLoading(true)
    try {
      const result = await window.api.getGitDiffFull(cwd)
      setDiffResult(result)
      setSelectedFile(null)
      setComments([])
      setCommentingLine(null)
    } finally {
      setLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    if (taskId && cwd) {
      fetchDiff()
    } else {
      setDiffResult(null)
      setSelectedFile(null)
      setComments([])
      setCommentingLine(null)
    }
  }, [taskId, cwd, fetchDiff])

  const handleClose = (): void => {
    setDiffReviewTaskId(null)
  }

  const handleMarkDone = (): void => {
    if (!taskId) return
    completeTask(taskId)
    toast.success('Task completed')
    handleClose()
  }

  const handleClickLine = (filePath: string, lineIndex: number, lineContent: string): void => {
    if (commentingLine?.filePath === filePath && commentingLine?.lineIndex === lineIndex) {
      setCommentingLine(null)
    } else {
      setCommentingLine({ filePath, lineIndex, lineContent })
    }
  }

  const handleAddComment = (text: string): void => {
    if (!commentingLine) return
    setComments((prev) => [
      ...prev,
      {
        filePath: commentingLine.filePath,
        lineIndex: commentingLine.lineIndex,
        lineContent: commentingLine.lineContent,
        comment: text
      }
    ])
    setCommentingLine(null)
  }

  const handleSendFeedback = async (): Promise<void> => {
    if (comments.length === 0 || !task) return
    const feedback = formatReviewFeedback(comments)

    // Resume the agent session with feedback
    if (
      task.agentSessionId &&
      task.assignedAgent &&
      project &&
      supportsExactSessionResume(task.assignedAgent)
    ) {
      const session = await window.api.createTerminal({
        agentType: task.assignedAgent,
        projectName: task.projectName,
        projectPath: project.path,
        branch: task.branch,
        useWorktree: task.useWorktree,
        resumeSessionId: task.agentSessionId,
        initialPrompt: buildFeedbackPrompt(feedback, task, project),
        taskId: task.id
      })
      addTerminal(session)
      startTask(task.id, session.id, task.assignedAgent, session.worktreePath)
      setFocusedTerminal(session.id)
      toast.success('Feedback sent to agent')
      handleClose()
    } else {
      // No resumable session — copy feedback to clipboard
      await navigator.clipboard.writeText(feedback)
      toast.info('Review feedback copied to clipboard')
    }
    setComments([])
    setCommentingLine(null)
  }

  const handleResizeStart = (e: React.PointerEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (ev: PointerEvent): void => {
      const delta = startX - ev.clientX
      const newWidth = Math.max(380, Math.min(900, startWidth + delta))
      setSidebarWidth(newWidth)
    }

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const stat = diffResult
    ? {
        filesChanged: diffResult.files.length,
        insertions: diffResult.files.reduce((s, f) => s + f.insertions, 0),
        deletions: diffResult.files.reduce((s, f) => s + f.deletions, 0)
      }
    : null

  const hasChanges = stat && (stat.insertions > 0 || stat.deletions > 0)

  return (
    <AnimatePresence>
      {taskId && task && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ background: 'rgba(0,0,0,0.6)' }}
          />

          <motion.div
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col border-l border-white/[0.08] shadow-2xl"
            style={{
              width: sidebarWidth,
              background: '#141416',
              paddingTop: 'var(--safe-top, 0px)',
              paddingRight: 'var(--safe-right, 0px)',
              paddingBottom: 'var(--safe-bottom, 0px)'
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500/30 transition-colors z-10"
              onPointerDown={handleResizeStart}
            />

            {/* Header */}
            <div className="px-3 py-2.5 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-gray-200 truncate block">
                    {task.title}
                  </span>
                  <span className="text-[11px] text-purple-400">Review Changes</span>
                </div>
                {stat && (
                  <span className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                    <span className="text-green-400">+{stat.insertions}</span>
                    <span className="text-red-400">-{stat.deletions}</span>
                    <span className="text-gray-500">
                      {stat.filesChanged} file{stat.filesChanged !== 1 ? 's' : ''}
                    </span>
                  </span>
                )}
                {hasChanges && (
                  <button
                    onClick={() => setShowCommitDialog(true)}
                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium
                               bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                               rounded-md transition-colors text-gray-300 hover:text-gray-100 shrink-0"
                    title="Commit changes"
                  >
                    <GitCommitHorizontal size={13} strokeWidth={1.5} />
                    Commit
                  </button>
                )}
                <button
                  onClick={handleMarkDone}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium
                             bg-green-500/10 hover:bg-green-500/20 border border-green-500/20
                             rounded-md transition-colors text-green-400 hover:text-green-300 shrink-0"
                  title="Mark task as done"
                >
                  <CheckCircle2 size={13} strokeWidth={1.5} />
                  Done
                </button>
                <button
                  onClick={fetchDiff}
                  disabled={loading}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors shrink-0"
                  title="Refresh"
                >
                  <RefreshCw
                    size={14}
                    className={loading ? 'animate-spin' : ''}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  onClick={handleClose}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors shrink-0"
                  title="Close"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Review feedback bar */}
            {comments.length > 0 && (
              <div className="px-3 py-2 border-b border-purple-500/15 bg-purple-500/[0.05] flex items-center gap-2 shrink-0">
                <MessageSquare size={13} className="text-purple-400 shrink-0" />
                <span className="text-[12px] text-purple-300 flex-1">
                  {comments.length} review comment{comments.length !== 1 ? 's' : ''}
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

            {/* Content */}
            {loading && !diffResult ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={20} className="text-gray-500 animate-spin" />
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
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                {cwd ? 'No changes' : 'No project path found'}
              </div>
            )}
          </motion.div>

          {showCommitDialog && (
            <CommitDialog
              cwd={cwd}
              branch={task.branch}
              stat={stat ?? undefined}
              onClose={() => setShowCommitDialog(false)}
              onCommitted={() => {
                fetchDiff()
                setShowCommitDialog(false)
              }}
            />
          )}
        </>
      )}
    </AnimatePresence>
  )
}
