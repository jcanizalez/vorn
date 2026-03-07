import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { GitDiffResult, GitFileDiff } from '../../shared/types'
import { X, RefreshCw, FileCode, FilePlus, FileMinus, FileSymlink, Loader2, GitCommitHorizontal, MessageSquare, Send } from 'lucide-react'
import { CommitDialog } from './CommitDialog'

export const STATUS_ICONS: Record<string, { icon: typeof FileCode; color: string; label: string }> = {
  modified: { icon: FileCode, color: 'text-yellow-400', label: 'M' },
  added: { icon: FilePlus, color: 'text-green-400', label: 'A' },
  deleted: { icon: FileMinus, color: 'text-red-400', label: 'D' },
  renamed: { icon: FileSymlink, color: 'text-blue-400', label: 'R' }
}

interface DiffComment {
  filePath: string
  lineIndex: number
  lineContent: string
  comment: string
}

export function DiffFileList({
  files,
  selectedFile,
  onSelectFile
}: {
  files: GitFileDiff[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
}) {
  return (
    <div className="border-b border-white/[0.06] max-h-[200px] overflow-y-auto">
      {files.map((file) => {
        const meta = STATUS_ICONS[file.status] || STATUS_ICONS.modified
        const Icon = meta.icon
        const isSelected = selectedFile === file.filePath
        return (
          <button
            key={file.filePath}
            onClick={() => onSelectFile(file.filePath)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors
                       ${isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
          >
            <Icon size={13} className={`${meta.color} shrink-0`} strokeWidth={1.5} />
            <span className="flex-1 min-w-0 truncate text-gray-300 font-mono">{file.filePath}</span>
            <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-mono">
              {file.insertions > 0 && <span className="text-green-400">+{file.insertions}</span>}
              {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function InlineCommentInput({
  onSubmit,
  onCancel
}: {
  onSubmit: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (text.trim()) onSubmit(text.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="mx-2 my-1 bg-blue-500/[0.08] border border-blue-500/20 rounded-md p-2">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add review comment..."
        rows={2}
        className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded text-xs
                   text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/30
                   resize-none font-mono"
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-gray-600">Cmd+Enter to submit</span>
        <div className="flex gap-1.5">
          <button
            onClick={onCancel}
            className="px-2 py-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={!text.trim()}
            className="px-2 py-1 text-[10px] font-medium text-blue-400 hover:text-blue-300
                       disabled:opacity-30 transition-colors"
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentBadge({ comment, onRemove }: { comment: DiffComment; onRemove: () => void }) {
  return (
    <div className="mx-2 my-0.5 bg-blue-500/[0.06] border border-blue-500/15 rounded-md px-3 py-1.5 flex items-start gap-2">
      <MessageSquare size={11} className="text-blue-400 mt-0.5 shrink-0" />
      <span className="text-xs text-blue-300 flex-1">{comment.comment}</span>
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-red-400 p-0.5 shrink-0 transition-colors"
      >
        <X size={10} strokeWidth={2} />
      </button>
    </div>
  )
}

export function DiffContent({
  files,
  selectedFile,
  comments,
  commentingLine,
  onClickLine,
  onAddComment,
  onCancelComment,
  onRemoveComment
}: {
  files: GitFileDiff[]
  selectedFile: string | null
  comments: DiffComment[]
  commentingLine: { filePath: string; lineIndex: number } | null
  onClickLine: (filePath: string, lineIndex: number, lineContent: string) => void
  onAddComment: (text: string) => void
  onCancelComment: () => void
  onRemoveComment: (index: number) => void
}) {
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (selectedFile) {
      const el = fileRefs.current.get(selectedFile)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedFile])

  return (
    <div className="flex-1 overflow-y-auto">
      {files.map((file) => {
        const meta = STATUS_ICONS[file.status] || STATUS_ICONS.modified
        const lines = parseDiffLines(file.diff, file.filePath, comments, commentingLine, onClickLine, onAddComment, onCancelComment, onRemoveComment)
        const fileCommentCount = comments.filter((c) => c.filePath === file.filePath).length

        return (
          <div
            key={file.filePath}
            ref={(el) => { if (el) fileRefs.current.set(file.filePath, el) }}
          >
            {/* File header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono
                            border-b border-white/[0.06]"
                 style={{ background: '#1e1e22' }}>
              <span className={`${meta.color} font-bold`}>{meta.label}</span>
              <span className="text-gray-300">{file.filePath}</span>
              {fileCommentCount > 0 && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full ml-auto">
                  {fileCommentCount} comment{fileCommentCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Diff lines */}
            <pre className="text-[12px] leading-[1.6] font-mono">
              {lines}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

function parseDiffLines(
  diff: string,
  filePath: string,
  allComments: DiffComment[],
  commentingLine: { filePath: string; lineIndex: number } | null,
  onClickLine: (filePath: string, lineIndex: number, lineContent: string) => void,
  onAddComment: (text: string) => void,
  onCancelComment: () => void,
  onRemoveComment: (index: number) => void
): React.ReactNode[] {
  const lines = diff.split('\n')
  const nodes: React.ReactNode[] = []
  let lineIndex = 0
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (const line of lines) {
    // Skip diff --git, index, ---, +++ header lines
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ')
    ) {
      lineIndex++
      continue
    }

    // Hunk header
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10)
      newLine = parseInt(hunkMatch[2], 10)
      inHunk = true
      nodes.push(
        <div key={lineIndex} className="bg-blue-500/10 text-blue-300 px-3 py-0.5 select-text">
          {line}
        </div>
      )
      lineIndex++
      continue
    }

    if (!inHunk) {
      // Binary diff or other metadata
      if (line.trim()) {
        nodes.push(
          <div key={lineIndex} className="text-gray-500 px-3 select-text">
            {line}
          </div>
        )
      }
      lineIndex++
      continue
    }

    const currentLineIndex = lineIndex
    const isCommentable = line.startsWith('+') || line.startsWith('-')
    const isCommenting = commentingLine?.filePath === filePath && commentingLine?.lineIndex === currentLineIndex

    // Find comments for this line (using global indices into allComments)
    const lineComments: { comment: DiffComment; globalIdx: number }[] = []
    allComments.forEach((c, globalIdx) => {
      if (c.filePath === filePath && c.lineIndex === currentLineIndex) {
        lineComments.push({ comment: c, globalIdx })
      }
    })

    if (line.startsWith('+')) {
      nodes.push(
        <div
          key={lineIndex}
          className={`bg-green-500/10 flex select-text group/line ${isCommentable ? 'cursor-pointer hover:bg-green-500/15' : ''}`}
          onClick={() => isCommentable && onClickLine(filePath, currentLineIndex, line)}
        >
          <span className="w-[35px] shrink-0 text-right pr-2 text-[11px] text-gray-600 select-none">{' '}</span>
          <span className="w-[35px] shrink-0 text-right pr-2 text-[11px] text-green-600 select-none">{newLine}</span>
          <span className="text-green-300 px-1 flex-1">{line.slice(1) || ' '}</span>
          {isCommentable && (
            <span className="opacity-0 group-hover/line:opacity-100 pr-2 text-blue-400 transition-opacity shrink-0">
              <MessageSquare size={11} strokeWidth={2} />
            </span>
          )}
        </div>
      )
      newLine++
    } else if (line.startsWith('-')) {
      nodes.push(
        <div
          key={lineIndex}
          className={`bg-red-500/10 flex select-text group/line ${isCommentable ? 'cursor-pointer hover:bg-red-500/15' : ''}`}
          onClick={() => isCommentable && onClickLine(filePath, currentLineIndex, line)}
        >
          <span className="w-[35px] shrink-0 text-right pr-2 text-[11px] text-red-600 select-none">{oldLine}</span>
          <span className="w-[35px] shrink-0 text-right pr-2 text-[11px] text-gray-600 select-none">{' '}</span>
          <span className="text-red-300 px-1 flex-1">{line.slice(1) || ' '}</span>
          {isCommentable && (
            <span className="opacity-0 group-hover/line:opacity-100 pr-2 text-blue-400 transition-opacity shrink-0">
              <MessageSquare size={11} strokeWidth={2} />
            </span>
          )}
        </div>
      )
      oldLine++
    } else if (line.startsWith(' ')) {
      nodes.push(
        <div key={lineIndex} className="flex select-text">
          <span className="w-[35px] shrink-0 text-right pr-2 text-[11px] text-gray-600 select-none">{oldLine}</span>
          <span className="w-[35px] shrink-0 text-right pr-2 text-[11px] text-gray-600 select-none">{newLine}</span>
          <span className="text-gray-400 px-1 flex-1">{line.slice(1) || ' '}</span>
        </div>
      )
      oldLine++
      newLine++
    }

    // Render existing comments for this line
    for (const { comment, globalIdx } of lineComments) {
      nodes.push(
        <CommentBadge
          key={`comment-${currentLineIndex}-${globalIdx}`}
          comment={comment}
          onRemove={() => onRemoveComment(globalIdx)}
        />
      )
    }

    // Render inline comment input if this is the active line
    if (isCommenting) {
      nodes.push(
        <InlineCommentInput
          key={`input-${currentLineIndex}`}
          onSubmit={onAddComment}
          onCancel={onCancelComment}
        />
      )
    }

    lineIndex++
  }

  return nodes
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

export function DiffSidebar() {
  const terminalId = useAppStore((s) => s.diffSidebarTerminalId)
  const terminal = useAppStore((s) => (terminalId ? s.terminals.get(terminalId) : undefined))
  const setDiffSidebar = useAppStore((s) => s.setDiffSidebarTerminalId)
  const stat = useAppStore((s) => (terminalId ? s.gitDiffStats.get(terminalId) : undefined))

  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(480)
  const [showCommitDialog, setShowCommitDialog] = useState(false)

  // Review comments state
  const [comments, setComments] = useState<DiffComment[]>([])
  const [commentingLine, setCommentingLine] = useState<{ filePath: string; lineIndex: number; lineContent: string } | null>(null)

  const fetchDiff = useCallback(async () => {
    if (!terminal) return
    const cwd = terminal.session.worktreePath || terminal.session.projectPath
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
  }, [terminal])

  useEffect(() => {
    if (terminalId && terminal) {
      fetchDiff()
    } else {
      setDiffResult(null)
      setSelectedFile(null)
      setComments([])
      setCommentingLine(null)
    }
  }, [terminalId, terminal, fetchDiff])

  const handleClose = (): void => {
    setDiffSidebar(null)
  }

  const cwd = terminal?.session.worktreePath || terminal?.session.projectPath || ''
  const hasChanges = stat && (stat.insertions > 0 || stat.deletions > 0)

  const handleCommitted = (): void => {
    fetchDiff()
    if (terminalId) {
      window.api.getGitDiffStat(cwd).then((s) => {
        if (s && terminalId) useAppStore.getState().updateGitDiffStat(terminalId, s)
      })
    }
  }

  const handleClickLine = (filePath: string, lineIndex: number, lineContent: string): void => {
    // Toggle: if clicking same line, close the input
    if (commentingLine?.filePath === filePath && commentingLine?.lineIndex === lineIndex) {
      setCommentingLine(null)
    } else {
      setCommentingLine({ filePath, lineIndex, lineContent })
    }
  }

  const handleAddComment = (text: string): void => {
    if (!commentingLine) return
    setComments((prev) => [...prev, {
      filePath: commentingLine.filePath,
      lineIndex: commentingLine.lineIndex,
      lineContent: commentingLine.lineContent,
      comment: text
    }])
    setCommentingLine(null)
  }

  const handleRemoveComment = (globalIdx: number): void => {
    setComments((prev) => prev.filter((_, i) => i !== globalIdx))
  }

  const handleSendFeedback = (): void => {
    if (comments.length === 0 || !terminalId) return
    const feedback = formatReviewFeedback(comments)
    window.api.writeTerminal(terminalId, feedback + '\n')
    setComments([])
    setCommentingLine(null)
  }

  const handleResizeStart = (e: React.PointerEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (ev: PointerEvent): void => {
      const delta = startX - ev.clientX
      const newWidth = Math.max(320, Math.min(800, startWidth + delta))
      setSidebarWidth(newWidth)
    }

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  return (
    <AnimatePresence>
      {terminalId && terminal && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{ background: '#141416' }}
          />

          {/* Sidebar */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 z-50 flex flex-col border-l border-white/[0.08]
                       shadow-2xl"
            style={{ width: sidebarWidth, background: '#141416' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            {/* Resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors z-10"
              onPointerDown={handleResizeStart}
            />

            {/* Header */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06] shrink-0">
              <span className="text-[13px] font-medium text-gray-200 flex-1">Changes</span>
              {stat && (
                <span className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-green-400">+{stat.insertions}</span>
                  <span className="text-red-400">-{stat.deletions}</span>
                  <span className="text-gray-500">{stat.filesChanged} file{stat.filesChanged !== 1 ? 's' : ''}</span>
                </span>
              )}
              {hasChanges && (
                <button
                  onClick={() => setShowCommitDialog(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium
                             bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06]
                             rounded-md transition-colors text-gray-300 hover:text-gray-100"
                  title="Commit changes"
                >
                  <GitCommitHorizontal size={13} strokeWidth={1.5} />
                  Commit
                </button>
              )}
              <button
                onClick={fetchDiff}
                disabled={loading}
                className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} strokeWidth={1.5} />
              </button>
              <button
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                title="Close"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            {/* Review feedback bar */}
            {comments.length > 0 && (
              <div className="px-3 py-2 border-b border-blue-500/15 bg-blue-500/[0.05] flex items-center gap-2 shrink-0">
                <MessageSquare size={13} className="text-blue-400 shrink-0" />
                <span className="text-[12px] text-blue-300 flex-1">
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
                             bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/20
                             rounded-md transition-colors text-blue-300 hover:text-blue-200"
                >
                  <Send size={11} strokeWidth={2} />
                  Send to Agent
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
                  onRemoveComment={handleRemoveComment}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                No changes
              </div>
            )}
          </motion.div>

          {showCommitDialog && (
            <CommitDialog
              cwd={cwd}
              branch={terminal.session.branch}
              stat={stat}
              onClose={() => setShowCommitDialog(false)}
              onCommitted={handleCommitted}
            />
          )}
        </>
      )}
    </AnimatePresence>
  )
}
