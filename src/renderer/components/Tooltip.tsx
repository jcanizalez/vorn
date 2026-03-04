import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  label: string
  children: React.ReactNode
  position?: 'top' | 'bottom'
  delay?: number
}

export function Tooltip({ label, children, position = 'top', delay = 400 }: Props) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const show = useCallback(() => {
    timeout.current = setTimeout(() => setVisible(true), delay)
  }, [delay])

  const hide = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current)
    setVisible(false)
  }, [])

  useLayoutEffect(() => {
    if (!visible || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = position === 'top' ? rect.top - 6 : rect.bottom + 6
    setCoords({ x, y })
  }, [visible, position])

  return (
    <div ref={wrapperRef} className="inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[100] px-2 py-1 rounded-md text-[11px] text-gray-200 whitespace-nowrap
                     border border-white/[0.08] shadow-lg pointer-events-none"
          style={{
            background: 'rgba(10, 14, 24, 0.95)',
            left: coords.x,
            top: coords.y,
            transform: position === 'top'
              ? 'translate(-50%, -100%)'
              : 'translate(-50%, 0)'
          }}
        >
          {label}
        </div>,
        document.body
      )}
    </div>
  )
}
