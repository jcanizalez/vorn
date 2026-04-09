import { useState, useEffect, useCallback } from 'react'
import {
  AgentType,
  WidgetAgentInfo,
  PermissionRequestInfo,
  PermissionSuggestion,
  AskUserQuestion
} from '../../shared/types'
import { AgentIcon } from './AgentIcon'

type ViewMode = 'full' | 'compact'

declare global {
  interface Window {
    widgetApi: {
      onStatusUpdate: (callback: (agents: WidgetAgentInfo[]) => void) => () => void
      onPermissionRequest: (callback: (request: PermissionRequestInfo) => void) => () => void
      onPermissionCancelled: (callback: (requestId: string) => void) => () => void
      respondPermission: (
        requestId: string,
        allow: boolean,
        extra?: { updatedPermissions?: unknown[]; updatedInput?: unknown }
      ) => void
      focusTerminal: (id: string) => void
      hideWidget: () => void
      showApp: () => void
      setViewMode: (mode: ViewMode) => void
    }
  }
}

const GLOW_COLORS: Record<AgentType, string> = {
  claude: 'rgba(217, 119, 87, 0.45)',
  copilot: 'rgba(255, 255, 255, 0.3)',
  codex: 'rgba(122, 157, 255, 0.45)',
  opencode: 'rgba(255, 255, 255, 0.3)',
  gemini: 'rgba(49, 134, 255, 0.45)'
}

type RespondFn = (
  requestId: string,
  allow: boolean,
  extra?: { updatedPermissions?: unknown[]; updatedInput?: unknown }
) => void

function labelSuggestion(s: PermissionSuggestion, toolName: string): string {
  switch (s.type) {
    case 'addRules': {
      const firstRule = s.rules?.[0]
      const name = firstRule?.toolName ?? toolName
      const ruleContent = firstRule?.ruleContent ?? ''
      if (ruleContent.includes('**')) {
        const dir = ruleContent.replace('/**', '').split('/').pop() || ruleContent
        return `Allow ${name} in ${dir}/`
      } else if (ruleContent) {
        const short = ruleContent.length > 30 ? ruleContent.slice(0, 27) + '…' : ruleContent
        return `Always allow \`${short}\``
      }
      return `Always allow ${name}`
    }
    case 'setMode':
      switch (s.mode) {
        case 'acceptEdits':
          return 'Auto-accept edits'
        case 'plan':
          return 'Switch to plan mode'
        default:
          return s.mode ?? 'Set mode'
      }
    default:
      return (s.label as string) ?? s.type
  }
}

function AskQuestionCard({
  request,
  onRespond
}: {
  request: PermissionRequestInfo
  onRespond: RespondFn
}) {
  const questions = request.questions ?? []
  const [selected, setSelected] = useState<Record<number, string>>({})
  const allAnswered = questions.every((_, i) => selected[i] !== undefined)

  function submit() {
    const answers: Record<string, string> = {}
    questions.forEach((_, i) => {
      if (selected[i]) answers[String(i)] = selected[i]
    })
    onRespond(request.requestId, true, { updatedInput: { ...request.toolInput, answers } })
  }

  return (
    <div className="permission-card">
      <div className="permission-header">
        <span className="permission-tool-badge">Question</span>
      </div>
      {questions.map((q: AskUserQuestion, qi: number) => (
        <div key={qi} className="ask-question">
          {q.header && <div className="ask-question-header">{q.header}</div>}
          <div className="ask-question-text">{q.question}</div>
          <div className="ask-question-options">
            {(q.options ?? []).map((opt, oi) => (
              <button
                key={oi}
                className={`ask-option-btn ${selected[qi] === opt.label ? 'ask-option-selected' : ''}`}
                onClick={() => setSelected((prev) => ({ ...prev, [qi]: opt.label }))}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="permission-actions">
        <button
          className="permission-btn permission-allow"
          onClick={submit}
          disabled={!allAnswered}
          style={!allAnswered ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          Submit
        </button>
        <button
          className="permission-btn permission-deny"
          onClick={() => onRespond(request.requestId, false)}
        >
          Skip
        </button>
      </div>
    </div>
  )
}

function PermissionCard({
  request,
  onRespond
}: {
  request: PermissionRequestInfo
  onRespond: RespondFn
}) {
  const filePath = request.toolInput?.file_path as string | undefined
  const command = request.toolInput?.command as string | undefined
  let context: string | undefined
  let contextKind: 'file' | 'cmd' | 'text' = 'text'
  if (filePath) {
    context = filePath.split('/').pop() || filePath
    contextKind = 'file'
  } else if (command) {
    context = command.length > 64 ? command.slice(0, 61) + '…' : command
    contextKind = 'cmd'
  } else if (request.description) {
    context = request.description
  }

  const suggestions = request.permissionSuggestions ?? []
  const isAskQuestion =
    request.toolName === 'AskUserQuestion' && (request.questions?.length ?? 0) > 0

  if (isAskQuestion) {
    return <AskQuestionCard request={request} onRespond={onRespond} />
  }

  return (
    <div className="permission-card">
      <div className="permission-header">
        <span className="permission-tool-badge">{request.toolName}</span>
      </div>
      {context && (
        <div className="permission-context">
          <span className="permission-context-prefix">{contextKind === 'file' ? '◈' : '$'}</span>
          <span className="permission-context-text">{context}</span>
        </div>
      )}
      <div className="permission-actions">
        <button
          className="permission-btn permission-allow"
          onClick={() => onRespond(request.requestId, true)}
        >
          Allow
        </button>
        <button
          className="permission-btn permission-deny"
          onClick={() => onRespond(request.requestId, false)}
        >
          Deny
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="permission-suggestions">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="permission-suggestion-btn"
              onClick={() => onRespond(request.requestId, true, { updatedPermissions: [s] })}
            >
              {labelSuggestion(s, request.toolName)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentSection({
  agent,
  permissions,
  onRespond
}: {
  agent: WidgetAgentInfo
  permissions: PermissionRequestInfo[]
  onRespond: RespondFn
}) {
  const isRunning = agent.status === 'running'
  const label = agent.displayName || agent.projectName

  return (
    <div>
      <div
        className="widget-row"
        onClick={() => window.widgetApi.focusTerminal(agent.id)}
        title={`${agent.projectName} — ${agent.status}`}
      >
        <div
          className={`flex items-center justify-center w-6 h-6 ${isRunning ? 'agent-icon-pulse agent-icon-glow' : ''}`}
          style={
            isRunning
              ? ({ '--glow-color': GLOW_COLORS[agent.agentType] } as React.CSSProperties)
              : undefined
          }
        >
          <AgentIcon agentType={agent.agentType} size={18} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {label}
          </div>
        </div>

        <div className={`status-dot status-${agent.status}`} />
      </div>

      {permissions.length > 0 && (
        <div className="permission-list">
          {permissions.map((req) => (
            <PermissionCard key={req.requestId} request={req} onRespond={onRespond} />
          ))}
        </div>
      )}
    </div>
  )
}

function CompactWidget({
  agents,
  setMode
}: {
  agents: WidgetAgentInfo[]
  setMode: (m: ViewMode) => void
}) {
  const running = agents.filter((a) => a.status === 'running').length
  const waiting = agents.filter((a) => a.status === 'waiting').length
  const errored = agents.filter((a) => a.status === 'error').length

  return (
    <div className="widget-container widget-compact">
      <div className="widget-compact-inner">
        <button
          className="widget-app-btn"
          onClick={() => window.widgetApi.showApp()}
          title="Open Vorn"
        >
          VG
        </button>
        <div className="widget-compact-dots">
          {running > 0 && (
            <div className="widget-compact-badge">
              <div className="status-dot status-running" style={{ width: 6, height: 6 }} />
              <span>{running}</span>
            </div>
          )}
          {waiting > 0 && (
            <div className="widget-compact-badge">
              <div className="status-dot status-waiting" style={{ width: 6, height: 6 }} />
              <span>{waiting}</span>
            </div>
          )}
          {errored > 0 && (
            <div className="widget-compact-badge">
              <div className="status-dot status-error" style={{ width: 6, height: 6 }} />
              <span>{errored}</span>
            </div>
          )}
          {agents.length === 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>0</span>
          )}
        </div>
        <div className="widget-mode-btns">
          <button className="widget-mode-btn" onClick={() => setMode('full')} title="Expand panel">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect
                x="1.5"
                y="1.5"
                width="7"
                height="7"
                rx="1.2"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M1.5 3.5H8.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            className="widget-mode-btn"
            onClick={() => window.widgetApi.hideWidget()}
            title="Hide widget"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export function Widget() {
  const [agents, setAgents] = useState<WidgetAgentInfo[]>([])
  const [permissions, setPermissions] = useState<PermissionRequestInfo[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('full')

  const respondPermission = useCallback(
    (
      requestId: string,
      allow: boolean,
      extra?: { updatedPermissions?: unknown[]; updatedInput?: unknown }
    ) => {
      window.widgetApi.respondPermission(requestId, allow, extra)
      setPermissions((prev) => prev.filter((p) => p.requestId !== requestId))
    },
    []
  )

  useEffect(() => {
    return window.widgetApi.onStatusUpdate(setAgents)
  }, [])

  useEffect(() => {
    return window.widgetApi.onPermissionRequest((request) => {
      setPermissions((prev) => {
        if (prev.some((p) => p.requestId === request.requestId)) return prev
        return [...prev, request]
      })
    })
  }, [])

  useEffect(() => {
    return window.widgetApi.onPermissionCancelled((requestId) => {
      setPermissions((prev) => prev.filter((p) => p.requestId !== requestId))
    })
  }, [])

  useEffect(() => {
    window.widgetApi.setViewMode(viewMode)
  }, [viewMode])

  if (viewMode === 'compact') {
    return <CompactWidget agents={agents} setMode={setViewMode} />
  }

  const running = agents.filter((a) => a.status === 'running').length
  const total = agents.length

  // Group permissions by terminalId for per-session display
  const permsByTerminal = new Map<string, PermissionRequestInfo[]>()
  for (const p of permissions) {
    if (p.terminalId) {
      const list = permsByTerminal.get(p.terminalId) ?? []
      list.push(p)
      permsByTerminal.set(p.terminalId, list)
    }
  }

  return (
    <div className="widget-container">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="widget-app-btn"
            onClick={() => window.widgetApi.showApp()}
            title="Open Vorn"
            style={{ fontSize: 13 }}
          >
            Vorn
          </button>
          {total > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {running}/{total}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="widget-header-btn"
            onClick={() => setViewMode('compact')}
            title="Collapse"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="widget-header-btn"
            onClick={() => window.widgetApi.hideWidget()}
            title="Hide widget"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3 3L9 9M9 3L3 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="widget-body">
        {agents.length === 0 ? (
          <div className="widget-empty">No active agents</div>
        ) : (
          agents.map((agent) => (
            <AgentSection
              key={agent.id}
              agent={agent}
              permissions={permsByTerminal.get(agent.id) ?? []}
              onRespond={respondPermission}
            />
          ))
        )}
      </div>
    </div>
  )
}
