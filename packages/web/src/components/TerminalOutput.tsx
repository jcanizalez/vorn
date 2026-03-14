import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, GitBranch } from 'lucide-react'
import type { TerminalSession, AgentStatus } from '@vibegrid/shared/types'

interface TerminalOutputProps {
  session: TerminalSession
  onBack: () => void
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: 'text-green-400',
  waiting: 'text-yellow-400',
  idle: 'text-gray-400',
  error: 'text-red-400'
}

// Strip ANSI escape codes for clean display
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
}

export function TerminalOutput({ session, onBack }: TerminalOutputProps) {
  const [lines, setLines] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)

  // Get terminal data from the shared buffer
  const getTerminalData = useCallback(() => {
    const getter = (window as unknown as Record<string, unknown>).__vibegridTerminalData as
      | ((id: string) => string[])
      | undefined
    return getter?.(session.id) ?? []
  }, [session.id])

  // Poll for new data (terminal data is stored in a ref to avoid re-render storms)
  useEffect(() => {
    const interval = setInterval(() => {
      const data = getTerminalData()
      if (data.length > 0) {
        setLines((prev) => {
          const combined = [...prev, ...data.splice(0, data.length)].join('').split('\n')
          // Cap at 5000 lines
          if (combined.length > 5000) {
            return combined.slice(combined.length - 5000)
          }
          return combined
        })
      }
    }, 200)

    return () => clearInterval(interval)
  }, [getTerminalData])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  // Detect if user scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 40
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {session.displayName ?? session.agentType}
            </span>
            <span className={`text-xs ${STATUS_COLORS[session.status]}`}>{session.status}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="truncate">{session.projectName}</span>
            {session.branch && (
              <>
                <span className="text-gray-600">|</span>
                <GitBranch className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{session.branch}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5 text-gray-300 bg-black/30"
      >
        {lines.length === 0 ? (
          <div className="text-gray-600 italic">Waiting for output...</div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {stripAnsi(line) || '\u00A0'}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
