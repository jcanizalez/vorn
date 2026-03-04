import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderGit2, Trash2, FolderOpen } from 'lucide-react'

interface WorktreeCleanupInfo {
  id: string
  projectPath: string
  worktreePath: string
}

export function WorktreeCleanupDialog() {
  const [pending, setPending] = useState<WorktreeCleanupInfo | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const unsub = window.api.onWorktreeCleanup((session) => {
      setPending(session)
    })
    return unsub
  }, [])

  const handleKeep = (): void => {
    setPending(null)
  }

  const handleRemove = async (): Promise<void> => {
    if (!pending) return
    setRemoving(true)
    await window.api.removeWorktree(pending.projectPath, pending.worktreePath)
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
            style={{ background: 'rgba(12, 16, 28, 0.95)' }}
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
              <FolderGit2 size={18} className="text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-white">Worktree Session Ended</h3>
                <p className="text-xs text-gray-500 mt-0.5">Would you like to keep or remove the worktree?</p>
              </div>
            </div>

            <div className="px-5 py-3">
              <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                <p className="text-[11px] text-gray-500 font-mono truncate">{pending.worktreePath}</p>
              </div>
            </div>

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
                disabled={removing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400
                           bg-red-500/[0.08] hover:bg-red-500/[0.15]
                           disabled:opacity-50 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
                {removing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
