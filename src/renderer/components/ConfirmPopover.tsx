import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfirmPopoverProps {
  /** The trigger element — rendered as a child */
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
  /** Confirmation message */
  message: string
  /** Label for the confirm button */
  confirmLabel?: string
  /** Called when user confirms */
  onConfirm: () => void
  /** Destructive styling (red) */
  destructive?: boolean
}

export function ConfirmPopover({
  children,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  destructive = true
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const popoverRef = useRef<HTMLDivElement>(null)

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // The wrapper div uses display:contents so getBoundingClientRect returns zeros.
    // Measure the actual clicked element (button) instead.
    const el = (e.target as HTMLElement).closest('button') ?? (e.target as HTMLElement)
    const rect = el.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2
    })
    setOpen(true)
  }

  const handleConfirm = () => {
    setOpen(false)
    onConfirm()
  }

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return

    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <>
      <div onClick={handleTrigger} className="contents">
        {children}
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="fixed z-[150] rounded-lg border border-white/[0.1] shadow-2xl p-3"
              style={{
                top: position.top,
                left: position.left,
                transform: 'translateX(-50%)',
                background: '#1e1e22',
                minWidth: 180
              }}
            >
              <p className="text-xs text-gray-300 mb-3">{message}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200
                             bg-white/[0.04] hover:bg-white/[0.08] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  autoFocus
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    destructive
                      ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20'
                      : 'text-white bg-white/[0.1] hover:bg-white/[0.15]'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
