import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../stores'
import { TerminalInstance } from './TerminalInstance'
import { AgentIcon } from './AgentIcon'
import { StatusBadge } from './StatusBadge'
import { TrafficLights } from './TrafficLights'
import { InlineRename } from './InlineRename'
import { OpenInButton } from './OpenInButton'
import { CommitDialog } from './CommitDialog'
import { DiffFileList, DiffContent } from './DiffSidebar'
import { AGENT_DEFINITIONS } from '../lib/agent-definitions'
import { destroyTerminal } from '../lib/terminal-registry'
import { getDisplayName } from '../lib/terminal-display'
import { useTerminalScrollButton } from '../hooks/useTerminalScrollButton'
import { GitBranch, FolderGit2, GitCommitHorizontal, FileCode2, RefreshCw, Loader2, Server, ArrowDown } from 'lucide-react'
import { GitDiffResult } from '../../shared/types'
import { toast } from './Toast'

const isMac = navigator.platform.toUpperCase().includes('MAC')
const MOD = isMac ? '⌘' : 'Ctrl+'

export function FocusedTerminal() {
  const focusedId = useAppStore((s) => s.focusedTerminalId)
  const terminal = useAppStore((s) => focusedId ? s.terminals.get(focusedId) : undefined)
  const setFocused = useAppStore((s) => s.setFocusedTerminal)
  const removeTerminal = useAppStore((s) => s.removeTerminal)
  const isRenaming = useAppStore((s) => s.renamingTerminalId === focusedId)
  const setRenamingTerminalId = useAppStore((s) => s.setRenamingTerminalId)
  const renameTerminal = useAppStore((s) => s.renameTerminal)
  const stat = useAppStore((s) => focusedId ? s.gitDiffStats.get(focusedId) : undefined)

  const [showDiffPanel, setShowDiffPanel] = useState(false)
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [diffResult, setDiffResult] = useState<GitDiffResult | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diffPanelWidth, setDiffPanelWidth] = useState(420)
  const { showScrollBtn, handleScrollToBottom } = useTerminalScrollButton(focusedId)

  const cwd = terminal?.session.worktreePath || terminal?.session.projectPath || ''

  const fetchDiff = useCallback(async () => {
    if (!cwd) return
    setDiffLoading(true)
    try {
      const result = await window.api.getGitDiffFull(cwd)
      setDiffResult(result)
      setSelectedFile(null)
    } finally {
      setDiffLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    if (showDiffPanel && cwd) {
      fetchDiff()
    }
  }, [showDiffPanel, cwd, fetchDiff])

  // Reset panel state when switching terminals
  useEffect(() => {
    setShowDiffPanel(false)
    setDiffResult(null)
    setShowCommitDialog(false)
  }, [focusedId])

  if (!focusedId || !terminal) return null

  const def = AGENT_DEFINITIONS[terminal.session.agentType]

  const handleContract = (): void => {
    setFocused(null)
  }

  const handleKill = async (): Promise<void> => {
    const name = getDisplayName(terminal.session)
    // Clear focus FIRST to prevent re-renders referencing the deleted terminal
    setFocused(null)
    try {
      await window.api.killTerminal(focusedId)
      destroyTerminal(focusedId)
      removeTerminal(focusedId)
      toast.success(`Session "${name}" closed`)
    } catch (err) {
      console.error('[FocusedTerminal] killTerminal failed:', err)
      // Restore focus — the terminal is still running in the backend
      setFocused(focusedId)
    }
  }

  const handleToggleDiff = (): void => {
    setShowDiffPanel(!showDiffPanel)
  }

  const handleCommitted = (): void => {
    // Refresh diff after commit
    if (showDiffPanel) fetchDiff()
    // Refresh stats
    const updateStat = useAppStore.getState().updateGitDiffStat
    window.api.getGitDiffStat(cwd).then((s) => {
      if (s && focusedId) updateStat(focusedId, s)
    })
  }

  const handleResizeStart = (e: React.PointerEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = diffPanelWidth

    const onMove = (ev: PointerEvent): void => {
      const delta = startX - ev.clientX
      const newWidth = Math.max(280, Math.min(700, startWidth + delta))
      setDiffPanelWidth(newWidth)
    }

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const hasChanges = stat && (stat.insertions > 0 || stat.deletions > 0)

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={handleContract}
      />

      {/* Focused panel */}
      <motion.div
        className="fixed inset-3 z-50 rounded-xl border border-white/[0.08]
                   shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#1a1a1e' }}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Title bar — pl-[78px] for macOS traffic light safe zone */}
        <div
          className="flex items-center gap-3 pl-[78px] pr-4 py-2.5 border-b border-white/[0.06] titlebar-no-drag"
          onDoubleClick={(e) => {
            // Contract on double-click, but not if clicking on a button or interactive element
            if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return
            handleContract()
          }}
        >
          <AgentIcon agentType={terminal.session.agentType} size={16} />
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <InlineRename
                value={getDisplayName(terminal.session)}
                onCommit={(name) => {
                  renameTerminal(focusedId, name)
                  setRenamingTerminalId(null)
                }}
                onCancel={() => setRenamingTerminalId(null)}
                className="text-[13px] font-medium"
              />
            ) : (
              <span
                className="text-[13px] font-medium text-gray-200 cursor-default"
                onDoubleClick={() => setRenamingTerminalId(focusedId)}
              >
                {getDisplayName(terminal.session)}
              </span>
            )}
            <span className="text-[13px] text-gray-500 ml-2">{def.displayName}</span>
            {terminal.session.branch && (
              <span className="flex items-center gap-1 ml-3">
                {terminal.session.isWorktree ? (
                  <FolderGit2 size={12} className="text-amber-500" strokeWidth={1.5} />
                ) : (
                  <GitBranch size={12} className="text-gray-600" strokeWidth={1.5} />
                )}
                <span className={`text-[12px] font-mono ${terminal.session.isWorktree ? 'text-amber-400' : 'text-gray-500'}`}>
                  {terminal.session.branch}
                </span>
                {terminal.session.isWorktree && (
                  <span className="text-[11px] text-amber-500/60 ml-1">worktree</span>
                )}
              </span>
            )}
            {terminal.session.remoteHostLabel && (
              <span className="flex items-center gap-1 ml-3">
                <Server size={12} className="text-blue-400" strokeWidth={1.5} />
                <span className="text-[12px] font-mono text-blue-400">
                  {terminal.session.remoteHostLabel}
                </span>
                <span className="text-[11px] text-blue-400/60 ml-1">remote</span>
              </span>
            )}
          </div>

          {/* Git changes indicator */}
          {hasChanges && (
            <button
              onClick={handleToggleDiff}
              className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono rounded-md border transition-colors
                         ${showDiffPanel
                           ? 'bg-white/[0.08] border-white/[0.12] text-gray-200'
                           : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] text-gray-300'}`}
              title="Toggle changes panel"
            >
              <FileCode2 size={13} strokeWidth={1.5} />
              <span className="text-green-400">+{stat!.insertions}</span>
              <span className="text-red-400">-{stat!.deletions}</span>
            </button>
          )}

          <StatusBadge status={terminal.status} />

          {/* Keyboard shortcut hints */}
          <div className="flex items-center gap-2 text-[10px] text-gray-600 mx-1">
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-gray-500 font-mono">{MOD}W</kbd>
              close
            </span>
            <span className="flex items-center gap-0.5">
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-gray-500 font-mono">{MOD}[</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-gray-500 font-mono">{MOD}]</kbd>
              cycle
            </span>
          </div>

          <OpenInButton projectPath={terminal.session.projectPath} />
          <TrafficLights
            onClose={handleKill}
            onMinimize={handleContract}
            onExpand={handleContract}
            expanded
          />
        </div>

        {/* Content area: terminal + optional diff panel */}
        <div className="flex-1 flex min-h-0">
          {/* Terminal */}
          <div className="relative flex-1 p-1 min-w-0" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
            <TerminalInstance terminalId={focusedId} isFocused={true} />
            {showScrollBtn && (
              <button
                className="absolute bottom-4 right-4 w-8 h-8 flex items-center justify-center
                           rounded bg-white/[0.08] hover:bg-white/[0.15] text-gray-400 hover:text-white
                           transition-colors z-10"
                onClick={handleScrollToBottom}
                title="Scroll to bottom"
              >
                <ArrowDown size={14} />
              </button>
            )}
          </div>

          {/* Diff panel */}
          {showDiffPanel && (
            <div
              className="relative flex flex-col border-l border-white/[0.06] shrink-0"
              style={{ width: diffPanelWidth, background: '#141416' }}
            >
              {/* Resize handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors z-10"
                onPointerDown={handleResizeStart}
              />

              {/* Diff panel header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
                <span className="text-[12px] font-medium text-gray-300 flex-1">Changes</span>
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
                  disabled={diffLoading}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={13} className={diffLoading ? 'animate-spin' : ''} strokeWidth={1.5} />
                </button>
              </div>

              {/* Diff content */}
              {diffLoading && !diffResult ? (
                <div className="flex-1 flex items-center justify-center">
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
                    comments={[]}
                    commentingLine={null}
                    onClickLine={() => {}}
                    onAddComment={() => {}}
                    onCancelComment={() => {}}
                    onRemoveComment={() => {}}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-[13px]">
                  No changes
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Commit dialog */}
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
