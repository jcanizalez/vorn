import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderGit2, Trash2, FolderOpen, AlertTriangle, Loader2 } from 'lucide-react'
import { useAppStore } from '../stores'

interface WorktreeCleanupInfo {
  id: string
  projectPath: string
  worktreePath: string
}

interface ExplicitDeleteInfo {
  projectPath: string
  worktreePath: string
  sessionIds: string[]
}

type DialogMode = 'session-exit' | 'explicit-delete'
type DirtyState = 'checking' | 'clean' | 'dirty' | 'unknown'

type ExplicitDeleteCallback = (info: ExplicitDeleteInfo) => void
const subscribers = new Set<ExplicitDeleteCallback>()

// eslint-disable-next-line react-refresh/only-export-components -- lightweight pub/sub trigger, not a component
export function requestWorktreeDelete(info: ExplicitDeleteInfo): void {
  for (const cb of subscribers) cb(info)
}

function useExplicitDeleteSubscription(cb: ExplicitDeleteCallback): void {
  const cbRef = useRef(cb)
  useEffect(() => {
    cbRef.current = cb
  })
  useEffect(() => {
    const handler: ExplicitDeleteCallback = (info) => cbRef.current(info)
    subscribers.add(handler)
    return () => {
      subscribers.delete(handler)
    }
  }, [])
}

export function WorktreeCleanupDialog() {
  const [pending, setPending] = useState<WorktreeCleanupInfo | null>(null)
  const [explicitDelete, setExplicitDelete] = useState<ExplicitDeleteInfo | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState(false)
  const [dirtyState, setDirtyState] = useState<DirtyState>('checking')
  const checkIdRef = useRef(0)

  const dialogMode: DialogMode = explicitDelete ? 'explicit-delete' : 'session-exit'
  const activePath = explicitDelete?.worktreePath ?? pending?.worktreePath
  const activeProjectPath = explicitDelete?.projectPath ?? pending?.projectPath
  const isVisible = !!(pending || explicitDelete)

  // Check dirty state when dialog info changes
  const checkDirty = useCallback((worktreePath: string) => {
    const id = ++checkIdRef.current
    setDirtyState('checking')
    setRemoveError(false)
    setRemoving(false)
    window.api
      .isWorktreeDirty(worktreePath)
      .then((dirty) => {
        if (checkIdRef.current === id) setDirtyState(dirty ? 'dirty' : 'clean')
      })
      .catch(() => {
        if (checkIdRef.current === id) setDirtyState('unknown')
      })
  }, [])

  // Session-exit mode listener
  useEffect(() => {
    const unsub = window.api.onWorktreeCleanup((session) => {
      setPending(session)
      checkDirty(session.worktreePath)
    })
    return unsub
  }, [checkDirty])

  // Explicit-delete mode listener
  useExplicitDeleteSubscription(
    useCallback(
      (info: ExplicitDeleteInfo) => {
        setExplicitDelete(info)
        setPending(null)
        checkDirty(info.worktreePath)
      },
      [checkDirty]
    )
  )

  const handleClose = (): void => {
    setPending(null)
    setExplicitDelete(null)
  }

  const handleRemove = async (): Promise<void> => {
    if (!activePath || !activeProjectPath) return
    setRemoving(true)
    setRemoveError(false)
    try {
      if (explicitDelete && explicitDelete.sessionIds.length > 0) {
        await Promise.all(
          explicitDelete.sessionIds.flatMap((sid) => [
            window.api.killTerminal(sid).catch(() => {}),
            window.api.killHeadlessSession(sid).catch(() => {})
          ])
        )
        // Brief delay for processes to release file locks
        await new Promise((r) => setTimeout(r, 500))
      }

      const force = dirtyState === 'dirty' || dirtyState === 'unknown'
      const removed = await window.api.removeWorktree(activeProjectPath, activePath, force)
      if (removed) {
        useAppStore.getState().loadWorktrees(activeProjectPath, true)
        handleClose()
      } else {
        setRemoveError(true)
      }
    } catch {
      setRemoveError(true)
    } finally {
      setRemoving(false)
    }
  }

  const showWarning = dirtyState === 'dirty' || dirtyState === 'unknown'
  const sessionCount = explicitDelete?.sessionIds.length ?? 0

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed top-1/2 left-1/2 z-[60] w-[420px] border border-white/[0.08]
                       rounded-xl shadow-2xl overflow-hidden"
            style={{ background: '#1e1e22' }}
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <FolderGit2 size={18} className="text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-white">
                  {dialogMode === 'explicit-delete' ? 'Remove Worktree' : 'Worktree Session Ended'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {dialogMode === 'explicit-delete'
                    ? sessionCount > 0
                      ? 'This worktree has active sessions'
                      : 'Remove this worktree from disk?'
                    : 'Would you like to keep or remove the worktree?'}
                </p>
              </div>
            </div>

            <div className="px-5 py-3">
              <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <p className="text-[11px] text-gray-500 font-mono truncate">{activePath}</p>
              </div>
            </div>

            {/* Active sessions warning (explicit-delete mode) */}
            {dialogMode === 'explicit-delete' && sessionCount > 0 && (
              <div className="mx-5 mb-2 px-3 py-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/90">
                  {sessionCount} session{sessionCount > 1 ? 's are' : ' is'} running in this
                  worktree. {sessionCount > 1 ? 'They' : 'It'} will be terminated.
                </p>
              </div>
            )}

            {/* Dirty / unknown warning */}
            {dirtyState !== 'checking' && showWarning && (
              <div className="mx-5 mb-2 px-3 py-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/90">
                  {dirtyState === 'dirty'
                    ? 'This worktree has uncommitted changes that will be permanently lost.'
                    : 'Unable to check for uncommitted changes. Removal will use --force.'}
                </p>
              </div>
            )}

            {/* Remove error */}
            {removeError && (
              <div className="mx-5 mb-2 px-3 py-2 bg-red-500/[0.08] border border-red-500/20 rounded-lg">
                <p className="text-[11px] text-red-300">Failed to remove worktree.</p>
              </div>
            )}

            <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300
                           bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                {dialogMode === 'explicit-delete' ? (
                  'Cancel'
                ) : (
                  <>
                    <FolderOpen size={12} />
                    Keep
                  </>
                )}
              </button>
              <button
                onClick={handleRemove}
                disabled={removing || dirtyState === 'checking'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors
                           disabled:opacity-50 ${
                             showWarning || (dialogMode === 'explicit-delete' && sessionCount > 0)
                               ? 'text-red-300 bg-red-500/[0.15] hover:bg-red-500/[0.25] border border-red-500/30'
                               : 'text-red-400 bg-red-500/[0.08] hover:bg-red-500/[0.15]'
                           }`}
              >
                {removing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {sessionCount > 0 ? 'Closing sessions...' : 'Removing...'}
                  </>
                ) : (
                  <>
                    <Trash2 size={12} />
                    {dirtyState === 'checking'
                      ? 'Checking...'
                      : dialogMode === 'explicit-delete' && sessionCount > 0
                        ? 'Close sessions & remove'
                        : showWarning
                          ? 'Remove anyway'
                          : 'Remove'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
