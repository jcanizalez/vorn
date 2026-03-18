import { useState, useCallback, useRef } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

interface KeyDef {
  label: string | React.ReactNode
  /** Data to send via writeTerminal. If undefined, key has custom behavior (e.g. Ctrl). */
  data?: string
  /** Width multiplier (1 = standard, 1.5 = wider) */
  wide?: boolean
}

const KEYS: KeyDef[] = [
  { label: 'Esc', data: '\x1b' },
  { label: 'Tab', data: '\x09' },
  { label: 'Ctrl' }, // sticky modifier — handled specially
  { label: <ArrowUp size={16} strokeWidth={2} />, data: '\x1b[A' },
  { label: <ArrowDown size={16} strokeWidth={2} />, data: '\x1b[B' },
  { label: <ArrowLeft size={16} strokeWidth={2} />, data: '\x1b[D' },
  { label: <ArrowRight size={16} strokeWidth={2} />, data: '\x1b[C' },
  { label: '|', data: '|' },
  { label: '/', data: '/' },
  { label: '~', data: '~' },
  { label: '-', data: '-' },
  { label: '_', data: '_' }
]

interface Props {
  terminalId: string
}

/**
 * Floating keyboard bar for mobile terminals (Termux-style).
 * Renders above the virtual keyboard inside FocusedTerminal.
 * Uses onPointerDown + preventDefault to avoid stealing focus from xterm.js.
 */
export function MobileTerminalKeybar({ terminalId }: Props) {
  const [ctrlActive, setCtrlActive] = useState(false)
  const ctrlTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const sendKey = useCallback(
    (data: string) => {
      if (ctrlActive && data.length === 1) {
        // Send Ctrl+<char>: ASCII control character = charCode - 64 (for uppercase)
        const code = data.toUpperCase().charCodeAt(0) - 64
        if (code >= 1 && code <= 26) {
          window.api.writeTerminal(terminalId, String.fromCharCode(code))
        } else {
          // Non-alpha char with Ctrl: just send the char
          window.api.writeTerminal(terminalId, data)
        }
        setCtrlActive(false)
        if (ctrlTimeoutRef.current) clearTimeout(ctrlTimeoutRef.current)
      } else {
        window.api.writeTerminal(terminalId, data)
      }
    },
    [terminalId, ctrlActive]
  )

  const handleCtrlToggle = useCallback(() => {
    setCtrlActive((prev) => {
      if (prev) {
        // Turning off
        if (ctrlTimeoutRef.current) clearTimeout(ctrlTimeoutRef.current)
        return false
      }
      // Turning on: auto-unstick after 5s if no key pressed
      if (ctrlTimeoutRef.current) clearTimeout(ctrlTimeoutRef.current)
      ctrlTimeoutRef.current = setTimeout(() => setCtrlActive(false), 5000)
      return true
    })
  }, [])

  const handleKeyPress = useCallback(
    (e: React.PointerEvent, key: KeyDef) => {
      // Prevent focus steal from xterm.js (which would dismiss the virtual keyboard)
      e.preventDefault()
      e.stopPropagation()

      if (!key.data) {
        // Ctrl key
        handleCtrlToggle()
        return
      }

      sendKey(key.data)
    },
    [sendKey, handleCtrlToggle]
  )

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto
                 bg-black/70 backdrop-blur-md border-t border-white/[0.1]
                 scrollbar-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {KEYS.map((key, i) => {
        const isCtrl = !key.data
        const isActive = isCtrl && ctrlActive

        return (
          <button
            key={i}
            onPointerDown={(e) => handleKeyPress(e, key)}
            className={`shrink-0 flex items-center justify-center rounded-md
                       text-[13px] font-mono select-none transition-colors
                       ${key.wide ? 'min-w-[52px]' : 'min-w-[40px]'} h-[38px] px-2
                       ${
                         isActive
                           ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/40'
                           : 'bg-white/[0.08] text-gray-300 border border-white/[0.06] active:bg-white/20'
                       }`}
          >
            {key.label}
          </button>
        )
      })}
    </div>
  )
}
