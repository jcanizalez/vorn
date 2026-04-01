import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  value: string
  onCommit: (newName: string) => void
  onCancel: () => void
  className?: string
}

export function InlineRename({ value, onCommit, onCancel, className }: Props) {
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)
  const userInteractedRef = useRef(false)

  useEffect(() => {
    // Delay focus to let competing focus-stealers (e.g. xterm.js) settle
    const timer = setTimeout(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        el.select()
      }
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  const commit = useCallback((): void => {
    if (committedRef.current) return
    committedRef.current = true
    const trimmed = text.trim()
    if (trimmed) {
      onCommit(trimmed)
    } else {
      onCancel()
    }
  }, [text, onCommit, onCancel])

  const handleBlur = useCallback((): void => {
    // Only commit on blur if user actually interacted (typed or focused manually).
    // Prevents auto-commit when xterm.js steals focus before user can interact.
    if (userInteractedRef.current) {
      commit()
    } else {
      onCancel()
    }
  }, [commit, onCancel])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation()
    userInteractedRef.current = true
    if (e.key === 'Enter') {
      commit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => {
        userInteractedRef.current = true
        setText(e.target.value)
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`bg-white/[0.06] border border-white/[0.15] rounded px-1.5 py-0.5
                  text-gray-200 focus:outline-none focus:border-white/[0.25] ${className ?? ''}`}
    />
  )
}
