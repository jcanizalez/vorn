import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores'
import { GitDiffResult } from '../../shared/types'
import { PanelTab } from '../stores/types'
import {
  DiffFileList,
  DiffContent,
  STATUS_ICONS,
  DiffComment,
  formatReviewFeedback
} from './DiffSidebar'
import { CommitDialog } from './CommitDialog'
import {
  X,
  RefreshCw,
  Loader2,
  GitCommitHorizontal,
  MessageSquare,
  Send,
  Maximize2,
  Minimize2,
  CircleDashed
} from 'lucide-react'

const TABS: PanelTab[] = ['all-files', 'changes', 'checks']
const TAB_LABELS: Record<PanelTab, string> = {
  'all-files': 'All files',
  changes: 'Changes',
  checks: 'Checks'
}

export function RightPanel() {
  const terminalId = useAppStore((s) => s.diffSidebarTerminalId)
  const terminal = useAppStore((s) => (terminalId ? s.terminals.get(terminalId) : undefined))
  const setDiffSidebar = useAppStore((s) => s.setDiffSidebarTerminalId)
  const stat = useAppStore((s) => (terminalId ? s.gitDiffStats.get(terminalId) : undefined))
  const activeTab = useAppStore((s) => s.rightPanelTab)
  const setActiveTab = useAppStore((s) => s.setRightPanelTab)
  const isMaximized = useAppStore((s) => s.isDiffPanelMaximized)
  const setMaximized = useAppStore((s) => s.setDiffPanelMaximized)
  const panelWidth = useAppStore((s) => s.diffPanelWidth)
  const setPanelWidth = useAppStore((s) => s.setDiffPanelWidth)

  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [showCommitDialog, setShowCommitDialog] = useState(false)

  const [comments, setComments] = useState<DiffComment[]>([])
  const [commentingLine, setCommentingLine] = useState<{
    filePath: string
    lineIndex: number
    lineContent: string
  } | null>(null)

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

  // Trigger resize so xterm instances re-fit when maximize toggles (drag-end fires its own)
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    return () => clearTimeout(timer)
  }, [isMaximized])

  if (!terminalId || !terminal) return null

  const cwd = terminal.session.worktreePath || terminal.session.projectPath || ''
  const hasChanges = stat && (stat.insertions > 0 || stat.deletions > 0)

  const handleClose = (): void => {
    setDiffSidebar(null)
    // xterm instances need a resize event after the panel unmounts to re-fit
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
  }

  const handleCommitted = (): void => {
    fetchDiff()
    if (terminalId) {
      window.api.getGitDiffStat(cwd).then((s) => {
        if (s && terminalId) useAppStore.getState().updateGitDiffStat(terminalId, s)
      })
    }
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
    if (isMaximized) setMaximized(false)
    const startX = e.clientX
    const startWidth = panelWidth

    const onMove = (ev: PointerEvent): void => {
      const delta = startX - ev.clientX
      const newWidth = Math.max(320, Math.min(800, startWidth + delta))
      setPanelWidth(newWidth)
    }

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      window.dispatchEvent(new Event('resize'))
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const handleFileClick = (filePath: string): void => {
    setSelectedFile(filePath)
    setActiveTab('changes')
  }

  const computedWidth = isMaximized ? 'calc(100vw - 80px)' : panelWidth

  return (
    <>
      <div
        className="relative flex flex-col border-l border-white/[0.06] shrink-0"
        style={{ width: computedWidth, background: '#141416' }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors z-10"
          onPointerDown={handleResizeStart}
        />

        {/* Tab bar */}
        <div className="flex items-center h-[36px] px-2 gap-0.5 border-b border-white/[0.06] shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors
                ${
                  activeTab === tab
                    ? 'bg-white/[0.1] text-gray-200'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}

          {/* Right side: maximize + close */}
          <div className="flex-1" />
          <button
            onClick={() => setMaximized(!isMaximized)}
            className="p-1 text-gray-500 hover:text-white rounded transition-colors"
            title={isMaximized ? 'Restore size' : 'Maximize'}
          >
            {isMaximized ? (
              <Minimize2 size={13} strokeWidth={1.5} />
            ) : (
              <Maximize2 size={13} strokeWidth={1.5} />
            )}
          </button>
          <button
            onClick={handleClose}
            className="p-1 text-gray-500 hover:text-white rounded transition-colors"
            title="Close panel"
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>

        {/* Changes tab header */}
        {activeTab === 'changes' && (
          <div className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.06] shrink-0">
            {stat && (
              <span className="flex items-center gap-1.5 text-[11px] font-mono">
                <span className="text-green-400">+{stat.insertions}</span>
                <span className="text-red-400">-{stat.deletions}</span>
                <span className="text-gray-500">
                  {stat.filesChanged} file{stat.filesChanged !== 1 ? 's' : ''}
                </span>
              </span>
            )}
            <div className="flex-1" />
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
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Review feedback bar */}
        {activeTab === 'changes' && comments.length > 0 && (
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

        {/* Tab content */}
        {activeTab === 'changes' && (
          <ChangesTabContent
            loading={loading}
            diffResult={diffResult}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            comments={comments}
            commentingLine={commentingLine}
            onClickLine={handleClickLine}
            onAddComment={handleAddComment}
            onCancelComment={() => setCommentingLine(null)}
            onRemoveComment={handleRemoveComment}
          />
        )}

        {activeTab === 'all-files' && (
          <AllFilesTabContent
            loading={loading}
            diffResult={diffResult}
            onFileClick={handleFileClick}
          />
        )}

        {activeTab === 'checks' && <ChecksTabContent />}
      </div>

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
  )
}

function ChangesTabContent({
  loading,
  diffResult,
  selectedFile,
  setSelectedFile,
  comments,
  commentingLine,
  onClickLine,
  onAddComment,
  onCancelComment,
  onRemoveComment
}: {
  loading: boolean
  diffResult: GitDiffResult | null
  selectedFile: string | null
  setSelectedFile: (path: string) => void
  comments: DiffComment[]
  commentingLine: { filePath: string; lineIndex: number } | null
  onClickLine: (filePath: string, lineIndex: number, lineContent: string) => void
  onAddComment: (text: string) => void
  onCancelComment: () => void
  onRemoveComment: (index: number) => void
}) {
  if (loading && !diffResult) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-gray-500 animate-spin" />
      </div>
    )
  }

  if (diffResult && diffResult.files.length > 0) {
    return (
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
          onClickLine={onClickLine}
          onAddComment={onAddComment}
          onCancelComment={onCancelComment}
          onRemoveComment={onRemoveComment}
        />
      </>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No changes</div>
  )
}

function AllFilesTabContent({
  loading,
  diffResult,
  onFileClick
}: {
  loading: boolean
  diffResult: GitDiffResult | null
  onFileClick: (path: string) => void
}) {
  if (loading && !diffResult) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!diffResult || diffResult.files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        No changed files
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {diffResult.files.map((file) => {
        const meta = STATUS_ICONS[file.status] || STATUS_ICONS.modified
        const Icon = meta.icon
        return (
          <button
            key={file.filePath}
            onClick={() => onFileClick(file.filePath)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-white/[0.04] transition-colors"
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

function ChecksTabContent() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 px-6">
      <CircleDashed size={24} strokeWidth={1.5} className="text-gray-600" />
      <span className="text-sm">No checks configured</span>
      <span className="text-[11px] text-gray-600 text-center">
        Checks for linting, tests, and CI status will appear here.
      </span>
    </div>
  )
}
