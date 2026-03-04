import { useRef, useEffect } from 'react'
import { attachTerminal, detachTerminal, fitTerminal, focusTerminal } from '../lib/terminal-registry'
import { useStatusDetection } from '../hooks/useStatusDetection'
import { useAppStore } from '../stores'

interface Props {
  terminalId: string
  isFocused: boolean
}

export function TerminalInstance({ terminalId, isFocused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useStatusDetection(terminalId)

  // Attach terminal to this container (moves DOM if already exists elsewhere)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    attachTerminal(terminalId, el)

    // Fit after a frame so the container has dimensions
    requestAnimationFrame(() => {
      fitTerminal(terminalId)
      if (isFocused) focusTerminal(terminalId)
    })

    return () => {
      if (el) detachTerminal(terminalId, el)
    }
  }, [terminalId, isFocused])

  // Re-fit when isFocused changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitTerminal(terminalId)
      if (isFocused) focusTerminal(terminalId)
    }, 50)
    return () => clearTimeout(timer)
  }, [isFocused, terminalId])

  // Fit on window resize
  useEffect(() => {
    const onResize = (): void => fitTerminal(terminalId)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [terminalId])

  // Re-fit when row height changes
  const rowHeight = useAppStore((s) => s.rowHeight)
  useEffect(() => {
    const timer = setTimeout(() => fitTerminal(terminalId), 50)
    return () => clearTimeout(timer)
  }, [rowHeight, terminalId])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  )
}
