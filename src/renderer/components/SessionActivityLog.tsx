import { useState, useEffect } from 'react'
import { XCircle, ChevronDown, ChevronRight, Maximize2, RotateCcw } from 'lucide-react'
import type { SessionLog, AgentType } from '../../shared/types'
import { StatusDot } from './workflow-editor/RunEntry'
import { Tooltip } from './Tooltip'

function formatRunTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDuration(start: string, end?: string): string {
  if (!end) return 'running...'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

interface SessionActivityLogProps {
  logs: SessionLog[]
  onViewFullOutput?: (logs: string) => void
  onResumeSession?: (
    agentSessionId: string,
    agentType: AgentType,
    projectName: string,
    projectPath: string,
    branch?: string,
    useWorktree?: boolean
  ) => void
  agentSessionId?: string
  projectPath?: string
}

function extractError(logs?: string): string | null {
  if (!logs) return null
  const lines = logs.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (
      line &&
      (line.includes('Error') ||
        line.includes('error') ||
        line.includes('FAIL') ||
        line.includes('exit code'))
    ) {
      return line.length > 200 ? line.slice(0, 200) + '...' : line
    }
  }
  return null
}

function countLines(s: string): number {
  let count = 1
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) count++
  }
  return count
}

const MAX_TRUNCATED_LENGTH = 1500

export function SessionActivityLog({
  logs,
  onViewFullOutput,
  onResumeSession,
  agentSessionId,
  projectPath
}: SessionActivityLogProps) {
  const [expandedIds, setExpandedIds] = useState(() => {
    const set = new Set<string>()
    if (logs.length > 0) set.add(logs[0].sessionId)
    for (const l of logs) {
      if (l.status === 'error') set.add(l.sessionId)
    }
    return set
  })

  // Auto-expand new errored entries when logs update via polling.
  // Build the set of IDs that should be expanded and compare with a
  // serialised key so the effect only fires when the set actually changes.
  const errorIds = logs.filter((l) => l.status === 'error').map((l) => l.sessionId)
  const errorKey = errorIds.join(',')
  useEffect(() => {
    if (errorIds.length === 0) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const id of errorIds) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorKey])

  const toggleExpanded = (sessionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-5 text-[11px] text-gray-600">
        No session activity yet.
        <br />
        Start the task to launch an agent.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {logs.map((entry) => {
        const isOpen = expandedIds.has(entry.sessionId)
        const errorMsg = entry.status === 'error' ? extractError(entry.logs) : null
        const truncatedOutput =
          entry.logs && entry.logs.length > MAX_TRUNCATED_LENGTH
            ? entry.logs.slice(0, MAX_TRUNCATED_LENGTH) + '\n...'
            : entry.logs
        const canResume = entry.status !== 'running' && agentSessionId && onResumeSession

        return (
          <div
            key={entry.sessionId}
            className="border border-white/[0.08] rounded-md overflow-hidden"
          >
            <button
              onClick={() => toggleExpanded(entry.sessionId)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={12} className="text-gray-500" />
              ) : (
                <ChevronRight size={12} className="text-gray-500" />
              )}
              <StatusDot status={entry.status} />
              <span className="text-[12px] text-gray-300 flex-1 min-w-0 truncate">
                {formatRunTime(entry.startedAt)}
                {entry.agentType && (
                  <span className="text-[10px] text-violet-400 font-mono ml-1.5">
                    {entry.agentType}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-gray-500 shrink-0">
                {formatDuration(entry.startedAt, entry.completedAt)}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-white/[0.06]">
                {errorMsg && (
                  <div className="mx-2.5 mt-2 mb-1 px-2.5 py-2 bg-red-500/[0.06] border border-red-500/[0.15] rounded-md flex items-start gap-2">
                    <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-red-400 font-mono leading-relaxed break-all">
                      {errorMsg}
                    </span>
                  </div>
                )}

                {truncatedOutput && (
                  <div className="px-2.5 pt-2 pb-1">
                    <pre
                      className="text-[11px] text-gray-400 bg-black/30 rounded-md p-2 max-h-[200px] overflow-auto
                                    font-mono whitespace-pre-wrap break-all leading-relaxed"
                    >
                      {truncatedOutput}
                    </pre>
                  </div>
                )}

                <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-gray-600 font-mono">
                  {entry.logs && <span>{countLines(entry.logs)} lines</span>}
                  {entry.exitCode !== undefined && (
                    <span className={entry.exitCode === 0 ? 'text-green-600' : 'text-red-600'}>
                      exit {entry.exitCode}
                    </span>
                  )}
                  {entry.status === 'running' && (
                    <span className="text-blue-400 animate-pulse">streaming</span>
                  )}
                </div>

                <div className="flex items-center gap-1 px-3 pb-2.5">
                  {onViewFullOutput && entry.logs && (
                    <Tooltip label="View full output">
                      <button
                        onClick={() => onViewFullOutput(entry.logs!)}
                        aria-label="View full output"
                        className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <Maximize2 size={12} strokeWidth={2} />
                      </button>
                    </Tooltip>
                  )}
                  {canResume && projectPath && (
                    <Tooltip label="Resume session">
                      <button
                        onClick={() =>
                          onResumeSession!(
                            agentSessionId!,
                            (entry.agentType as AgentType) || 'claude',
                            entry.projectName || '',
                            projectPath,
                            entry.branch
                          )
                        }
                        aria-label="Resume session"
                        className="p-1 rounded text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                      >
                        <RotateCcw size={12} strokeWidth={2} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
