import { useRef, useEffect } from 'react'
import {
  attachTerminal,
  detachTerminal,
  fitTerminal,
  focusTerminal,
  getViewportState,
  scrollToBottom
} from '../lib/terminal-registry'
import { useStatusDetection } from '../hooks/useStatusDetection'
import { useAppStore } from '../stores'

interface Props {
  terminalId: string
  isFocused: boolean
}

export function TerminalInstance({ terminalId, isFocused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useStatusDetection(terminalId)

  // Attach terminal to this container (moves DOM if already exists elsewhere).
  // isFocused is intentionally NOT a dependency — focus changes must not
  // trigger a detach/reattach cycle which reparents the DOM and resets scroll.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const savedViewport = getViewportState(terminalId)
    attachTerminal(terminalId, el)

    requestAnimationFrame(() => {
      fitTerminal(terminalId, savedViewport)
      if (!savedViewport) scrollToBottom(terminalId)
    })

    return () => {
      if (el) detachTerminal(terminalId, el)
    }
  }, [terminalId])

  // Handle focus separately — no DOM manipulation, just focus the terminal
  useEffect(() => {
    if (isFocused) {
      const timer = setTimeout(() => {
        fitTerminal(terminalId)
        focusTerminal(terminalId)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isFocused, terminalId])

  // Fit on window resize (debounced to avoid IPC flooding)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const onResize = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => fitTerminal(terminalId), 100)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [terminalId])

  // Re-fit when row height changes
  const rowHeight = useAppStore((s) => s.rowHeight)
  useEffect(() => {
    const timer = setTimeout(() => fitTerminal(terminalId), 50)
    return () => clearTimeout(timer)
  }, [rowHeight, terminalId])

  return <div ref={containerRef} className="w-full h-full" />
}
