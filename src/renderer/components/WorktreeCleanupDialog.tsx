import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderGit2, Trash2, FolderOpen, AlertTriangle } from 'lucide-react'

interface WorktreeCleanupInfo {
  id: string
  projectPath: string
  worktreePath: string
}

export function WorktreeCleanupDialog() {
  const [pending, setPending] = useState<WorktreeCleanupInfo | null>(null)
  const [removing, setRemoving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const unsub = window.api.onWorktreeCleanup((session) => {
      setIsDirty(false)
      setChecking(true)
      setPending(session)
      window.api
        .isWorktreeDirty(session.worktreePath)
        .then(setIsDirty)
        .catch(() => setIsDirty(false))
        .finally(() => setChecking(false))
    })
    return unsub
  }, [])

  const handleKeep = (): void => {
    setPending(null)
  }

  const handleRemove = async (): Promise<void> => {
    if (!pending) return
    setRemoving(true)
    await window.api.removeWorktree(pending.projectPath, pending.worktreePath, isDirty)
    setRemoving(false)
    setPending(null)
  }

  return (
    <AnimatePresence>
      {pending && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleKeep}
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
                <h3 className="text-sm font-medium text-white">Worktree Session Ended</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Would you like to keep or remove the worktree?
                </p>
              </div>
            </div>

            <div className="px-5 py-3">
              <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <p className="text-[11px] text-gray-500 font-mono truncate">
                  {pending.worktreePath}
                </p>
              </div>
            </div>

            {/* Dirty warning */}
            {!checking && isDirty && (
              <div className="mx-5 mb-2 px-3 py-2 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-300/90">
                  This worktree has uncommitted changes that will be permanently lost.
                </p>
              </div>
            )}

            <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
              <button
                onClick={handleKeep}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300
                           bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <FolderOpen size={12} />
                Keep
              </button>
              <button
                onClick={handleRemove}
                disabled={removing || checking}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors
                           disabled:opacity-50 ${
                             isDirty
                               ? 'text-red-300 bg-red-500/[0.15] hover:bg-red-500/[0.25] border border-red-500/30'
                               : 'text-red-400 bg-red-500/[0.08] hover:bg-red-500/[0.15]'
                           }`}
              >
                <Trash2 size={12} />
                {removing
                  ? 'Removing...'
                  : checking
                    ? 'Checking...'
                    : isDirty
                      ? 'Remove anyway'
                      : 'Remove'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
