import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AnchorRect, calculatePopoverPosition } from '../lib/popover-position'

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
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as const })
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePosition = (nextAnchor: AnchorRect): void => {
    const popoverRect = popoverRef.current?.getBoundingClientRect()
    const { top, left, placement } = calculatePopoverPosition(
      nextAnchor,
      {
        width: popoverRect?.width ?? 220,
        height: popoverRect?.height ?? 86
      },
      {
        width: window.innerWidth,
        height: window.innerHeight
      }
    )
    setPosition({ top, left, placement })
  }

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // The wrapper div uses display:contents so getBoundingClientRect returns zeros.
    // Measure the actual clicked element (button) instead.
    const el = (e.target as HTMLElement).closest('button') ?? (e.target as HTMLElement)
    const rect = el.getBoundingClientRect()
    const nextAnchor = {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    }
    setAnchorRect(nextAnchor)
    updatePosition(nextAnchor)
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

  useLayoutEffect(() => {
    if (!open || !anchorRect) return

    let frame = window.requestAnimationFrame(() => updatePosition(anchorRect))

    const handleViewportChange = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => updatePosition(anchorRect))
    }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open, anchorRect])

  const motionOffset = position.placement === 'top' ? 4 : -4

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
              initial={{ opacity: 0, y: motionOffset, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: motionOffset, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="fixed z-[150] rounded-lg border border-white/[0.1] shadow-2xl p-3"
              style={{
                top: position.top,
                left: position.left,
                transform: 'translateX(-50%)',
                transformOrigin: position.placement === 'top' ? 'bottom center' : 'top center',
                background: '#1e1e22',
                minWidth: 180,
                maxWidth: 'min(280px, calc(100vw - 16px))'
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
