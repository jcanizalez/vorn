import { useMemo, useEffect, useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../stores'
import {
  Monitor,
  Bot,
  ListTodo,
  Zap,
  LogOut,
  Plus,
  ArrowRight,
  Activity,
  Clock,
  Gauge
} from 'lucide-react'
import { AgentIcon } from '../AgentIcon'
import { ProjectIcon } from '../project-sidebar/ProjectIcon'
import type {
  AgentType,
  HeadlessSession,
  TaskConfig,
  SessionEvent,
  ProjectConfig
} from '../../../shared/types'

interface AgentUsageData {
  agentType: 'claude' | 'codex'
  session?: { utilization: number; resetsAt: string }
  weekly?: { utilization: number; resetsAt: string }
  extraUsage?: { used: number; limit: number; currency: string }
  lastUpdated: number
  error?: string
}

// ── Stable empty arrays ──
const EMPTY_HEADLESS: HeadlessSession[] = []
const EMPTY_TASKS: TaskConfig[] = []

// ── Helpers ──

function relativeTime(ts: string | number): string {
  const date = typeof ts === 'string' ? new Date(ts).getTime() : ts
  const diff = Date.now() - date
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusDot({ color, pulse, size = 8 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className="absolute animate-ping rounded-full opacity-75"
          style={{ width: size, height: size, background: color }}
        />
      )}
      <span
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: color,
          boxShadow: pulse ? `0 0 6px ${color}` : undefined
        }}
      />
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',
  waiting: '#eab308',
  idle: '#6b7280',
  error: '#ef4444'
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  detail,
  dotColor,
  pulse
}: {
  label: string
  value: number | string
  detail: string
  dotColor: string
  pulse?: boolean
}) {
  return (
    <div
      className="rounded-[10px] border border-white/[0.06] hover:border-white/[0.12] transition-colors p-3.5 flex flex-col gap-1.5"
      style={{ background: '#141416' }}
    >
      <div className="flex items-center gap-1.5">
        <StatusDot color={dotColor} pulse={pulse} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
      <div className="text-[26px] font-semibold text-gray-100 leading-none tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-gray-600">{detail}</div>
    </div>
  )
}

// ── Usage Meters ──

function barColor(pct: number): string {
  if (pct >= 85) return '#ef4444'
  if (pct >= 60) return '#eab308'
  return '#22c55e'
}

function formatResetTime(iso: string): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const hours = Math.floor(diff / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (hours === 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function UsageMeters({ usage }: { usage: AgentUsageData[] }) {
  if (usage.length === 0) return null

  const hasData = usage.some((u) => u.session || u.weekly)
  if (!hasData && usage.every((u) => u.error)) {
    return null // all errored, don't show empty section
  }

  return (
    <div
      className="rounded-[10px] border border-white/[0.06] p-4 flex flex-col gap-3.5"
      style={{ background: '#141416' }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
        <Gauge size={13} />
        Agent Usage
      </div>
      {usage.map((u) => (
        <UsageMeterAgent key={u.agentType} data={u} />
      ))}
    </div>
  )
}

function UsageMeterAgent({ data }: { data: AgentUsageData }) {
  const label = data.agentType === 'claude' ? 'Claude Code' : 'OpenAI Codex'

  if (data.error && !data.session && !data.weekly) {
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
          <AgentIcon agentType={data.agentType} size={18} />
        </span>
        <span className="text-[12px] font-medium text-gray-300">{label}</span>
        <span className="text-[11px] text-gray-600 ml-auto">{data.error}</span>
      </div>
    )
  }

  const sessionPct = data.session ? Math.round(data.session.utilization * 100) : null
  const weeklyPct = data.weekly ? Math.round(data.weekly.utilization * 100) : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
          <AgentIcon agentType={data.agentType} size={18} />
        </span>
        <span className="text-[12px] font-medium text-gray-300 flex-1">{label}</span>
      </div>
      <div className="flex flex-col gap-1.5 pl-7">
        {sessionPct != null && (
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] text-gray-600 w-[52px] shrink-0">Session</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${sessionPct}%`, background: barColor(sessionPct) }}
              />
            </div>
            <span
              className="text-[11px] font-semibold tabular-nums w-9 text-right"
              style={{ color: barColor(sessionPct) }}
            >
              {sessionPct}%
            </span>
          </div>
        )}
        {weeklyPct != null && (
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] text-gray-600 w-[52px] shrink-0">Weekly</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${weeklyPct}%`, background: barColor(weeklyPct) }}
              />
            </div>
            <span
              className="text-[11px] font-semibold tabular-nums w-9 text-right"
              style={{ color: barColor(weeklyPct) }}
            >
              {weeklyPct}%
            </span>
          </div>
        )}
      </div>
      {(data.session?.resetsAt || data.weekly?.resetsAt) && (
        <div className="text-[10px] text-gray-600 pl-7 flex items-center gap-1">
          <Clock size={10} className="opacity-50" />
          {data.session?.resetsAt && `Session resets in ${formatResetTime(data.session.resetsAt)}`}
          {data.session?.resetsAt && data.weekly?.resetsAt && ' · '}
          {data.weekly?.resetsAt && `Weekly resets in ${formatResetTime(data.weekly.resetsAt)}`}
        </div>
      )}
    </div>
  )
}

// ── Activity Feed ──

type ActivityFilter = 'all' | 'sessions' | 'workflows'

const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'workflows', label: 'Workflows' }
]

function ActivityFeed({
  events,
  onNavigate
}: {
  events: SessionEvent[]
  onNavigate?: (event: SessionEvent) => void
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'sessions') return events.filter((e) => e.eventType !== 'workflow_run')
    if (filter === 'workflows') return events.filter((e) => e.eventType === 'workflow_run')
    return events
  }, [events, filter])

  return (
    <div
      className="flex-[1.8] rounded-[10px] border border-white/[0.06] flex flex-col overflow-hidden min-w-0"
      style={{ background: '#141416' }}
    >
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Activity size={13} />
          Activity
        </span>
        <div className="flex items-center gap-0.5 p-0.5 bg-white/[0.03] rounded-md">
          {ACTIVITY_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                filter === f.id
                  ? 'bg-white/[0.08] text-gray-300 font-medium'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-[10px] px-1.5 rounded-full bg-white/[0.06] text-gray-600 leading-4 tabular-nums ml-1">
            {filtered.length}
          </span>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-600 text-[12px]">
            <Activity size={24} className="opacity-30" />
            <div>No {filter === 'all' ? '' : filter + ' '}activity</div>
          </div>
        ) : (
          filtered.map((ev, i) => (
            <ActivityRow key={ev.id ?? i} event={ev} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  )
}

function ActivityRow({
  event,
  onNavigate
}: {
  event: SessionEvent
  onNavigate?: (event: SessionEvent) => void
}) {
  const meta = event.metadata ?? {}
  const agentType = meta.agentType as AgentType | undefined
  const projectName = meta.projectName as string | undefined
  const branch = meta.branch as string | undefined
  const displayName = meta.displayName as string | undefined
  const exitCode = meta.exitCode as number | undefined
  const workflowName = meta.workflowName as string | undefined
  const workflowStatus = meta.status as string | undefined

  let icon: React.ReactNode
  let iconBg: string
  let iconColor: string
  let desc: React.ReactNode
  let badge: string
  let badgeBg: string
  let badgeColor: string

  switch (event.eventType) {
    case 'created': {
      const label = agentType ? agentType.charAt(0).toUpperCase() + agentType.slice(1) : 'Session'
      icon = <Plus size={12} />
      iconBg = 'rgba(34,197,94,0.15)'
      iconColor = '#22c55e'
      desc = (
        <>
          <strong>{label}</strong> session started
          {projectName && (
            <>
              {' '}
              on <strong>{projectName}</strong>
            </>
          )}
          {branch && ` (${branch})`}
        </>
      )
      badge = 'started'
      badgeBg = 'rgba(34,197,94,0.15)'
      badgeColor = '#22c55e'
      break
    }
    case 'exited': {
      const label = agentType ? agentType.charAt(0).toUpperCase() + agentType.slice(1) : 'Session'
      const hasError = exitCode != null && exitCode !== 0
      icon = <LogOut size={12} />
      iconBg = hasError ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)'
      iconColor = hasError ? '#ef4444' : '#6b7280'
      desc = (
        <>
          <strong>{label}</strong>
          {displayName && <> "{displayName}"</>} exited
          {exitCode != null && ` (${exitCode})`}
          {projectName && (
            <>
              {' '}
              on <strong>{projectName}</strong>
            </>
          )}
        </>
      )
      badge = hasError ? 'error' : 'exited'
      badgeBg = hasError ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)'
      badgeColor = hasError ? '#ef4444' : '#6b7280'
      break
    }
    case 'task_linked': {
      icon = <ArrowRight size={12} />
      iconBg = 'rgba(234,179,8,0.15)'
      iconColor = '#eab308'
      desc = (
        <>
          Session linked to task
          {displayName && (
            <>
              {' '}
              <strong>{displayName}</strong>
            </>
          )}
        </>
      )
      badge = 'linked'
      badgeBg = 'rgba(234,179,8,0.15)'
      badgeColor = '#eab308'
      break
    }
    case 'renamed': {
      const newName = (meta.displayName ?? meta.newName) as string | undefined
      const label = agentType ? agentType.charAt(0).toUpperCase() + agentType.slice(1) : 'Session'
      icon = <ArrowRight size={12} />
      iconBg = 'rgba(99,102,241,0.15)'
      iconColor = '#6366f1'
      desc = (
        <>
          <strong>{label}</strong> session renamed
          {newName && (
            <>
              {' '}
              to <strong>{newName}</strong>
            </>
          )}
          {projectName && (
            <>
              {' '}
              on <strong>{projectName}</strong>
            </>
          )}
        </>
      )
      badge = 'renamed'
      badgeBg = 'rgba(99,102,241,0.15)'
      badgeColor = '#6366f1'
      break
    }
    case 'archived': {
      icon = <LogOut size={12} />
      iconBg = 'rgba(107,114,128,0.15)'
      iconColor = '#6b7280'
      desc = (
        <>
          Session archived
          {projectName && (
            <>
              {' '}
              from <strong>{projectName}</strong>
            </>
          )}
        </>
      )
      badge = 'archived'
      badgeBg = 'rgba(107,114,128,0.15)'
      badgeColor = '#6b7280'
      break
    }
    case 'workflow_run' as string: {
      const isSuccess = workflowStatus === 'success'
      icon = <Zap size={12} />
      iconBg = isSuccess ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
      iconColor = isSuccess ? '#22c55e' : '#ef4444'
      desc = (
        <>
          <strong>{workflowName || 'Workflow'}</strong> {isSuccess ? 'succeeded' : 'failed'}
        </>
      )
      badge = isSuccess ? 'success' : 'failed'
      badgeBg = isSuccess ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
      badgeColor = isSuccess ? '#22c55e' : '#ef4444'
      break
    }
    default: {
      icon = <Activity size={12} />
      iconBg = 'rgba(107,114,128,0.15)'
      iconColor = '#6b7280'
      desc = <>{event.eventType}</>
      badge = event.eventType
      badgeBg = 'rgba(107,114,128,0.15)'
      badgeColor = '#6b7280'
    }
  }

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-[7px] border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors h-[36px]"
      onClick={() => onNavigate?.(event)}
    >
      <span className="text-[10px] text-gray-600 w-[44px] shrink-0 tabular-nums">
        {relativeTime(event.timestamp)}
      </span>
      <div
        className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      {agentType && (
        <span className="shrink-0 flex items-center" style={{ width: 14, height: 14 }}>
          <AgentIcon agentType={agentType} size={14} />
        </span>
      )}
      <span className="text-[12px] text-gray-400 flex-1 truncate min-w-0 [&_strong]:text-gray-300 [&_strong]:font-medium">
        {desc}
      </span>
      <span
        className="text-[10px] px-[7px] py-[2px] rounded-md font-medium shrink-0 whitespace-nowrap"
        style={{ background: badgeBg, color: badgeColor }}
      >
        {badge}
      </span>
    </div>
  )
}

// ── Active Work Panel ──

function ActiveWorkPanel({
  projects,
  sessions,
  tasks,
  headless
}: {
  projects: ProjectConfig[]
  sessions: {
    id: string
    projectName: string
    agentType: AgentType
    displayName?: string
    status: string
  }[]
  tasks: TaskConfig[]
  headless: HeadlessSession[]
}) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        color: string
        icon?: string
        sessions: typeof sessions
        tasks: TaskConfig[]
        headless: HeadlessSession[]
      }
    >()

    for (const p of projects) {
      map.set(p.name, {
        color: p.iconColor ?? '#6b7280',
        icon: p.icon,
        sessions: [],
        tasks: [],
        headless: []
      })
    }

    for (const s of sessions) {
      const group = map.get(s.projectName)
      if (group) group.sessions.push(s)
    }
    for (const t of tasks) {
      const group = map.get(t.projectName)
      if (group) group.tasks.push(t)
    }
    for (const h of headless) {
      const group = map.get(h.projectName)
      if (group) group.headless.push(h)
    }

    for (const [key, val] of map) {
      if (val.sessions.length === 0 && val.tasks.length === 0 && val.headless.length === 0) {
        map.delete(key)
      }
    }
    return map
  }, [projects, sessions, tasks, headless])

  return (
    <div
      className="rounded-[10px] border border-white/[0.06] flex flex-col overflow-hidden min-w-[240px] h-full"
      style={{ background: '#141416' }}
    >
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Zap size={13} />
          Active Work
        </span>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {grouped.size === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-600 text-[12px]">
            <Monitor size={24} className="opacity-30" />
            <div>No active work</div>
            <div className="text-[11px]">Launch a session or start a task</div>
          </div>
        ) : (
          Array.from(grouped).map(([name, group]) => (
            <div
              key={name}
              className="px-3 [&+&]:border-t [&+&]:border-white/[0.03] [&+&]:mt-1 [&+&]:pt-1"
            >
              <div className="flex items-center gap-1.5 px-1 py-1.5">
                <span className="shrink-0 flex items-center">
                  <ProjectIcon icon={group.icon} color={group.color} size={14} />
                </span>
                <span className="text-[11px] font-semibold text-gray-400">{name}</span>
              </div>

              {group.sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 py-1 px-1 pl-[26px] rounded-md hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="shrink-0" style={{ width: 14, height: 14 }}>
                    <AgentIcon agentType={s.agentType} size={14} />
                  </span>
                  <span className="text-[12px] text-gray-400 flex-1 truncate min-w-0">
                    {s.displayName || 'Session'}
                  </span>
                  <StatusDot
                    color={STATUS_COLORS[s.status] ?? '#6b7280'}
                    pulse={s.status === 'running' || s.status === 'waiting'}
                    size={7}
                  />
                </div>
              ))}

              {group.headless.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 py-1 px-1 pl-[26px] rounded-md hover:bg-white/[0.03] cursor-pointer"
                >
                  <Bot size={12} className="text-purple-400 shrink-0" />
                  <span className="text-[12px] text-gray-400 flex-1 truncate min-w-0">
                    {h.displayName || 'Headless agent'}
                  </span>
                  <StatusDot
                    color={h.status === 'running' ? '#a855f7' : '#6b7280'}
                    pulse={h.status === 'running'}
                    size={7}
                  />
                </div>
              ))}

              {group.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 py-1 px-1 pl-[26px] rounded-md hover:bg-white/[0.03] cursor-pointer"
                >
                  <ListTodo size={12} className="text-yellow-500 shrink-0" />
                  <span className="text-[12px] text-gray-400 flex-1 truncate min-w-0">
                    {t.title}
                  </span>
                  {t.assignedAgent && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 bg-white/[0.06] text-gray-500">
                      {t.assignedAgent}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main Command Center View ──

export function CommandCenterView() {
  const terminals = useAppStore(useShallow((s) => s.terminals))
  const headlessSessions = useAppStore((s) => s.headlessSessions) ?? EMPTY_HEADLESS
  const config = useAppStore((s) => s.config)
  const activeWorkspace = useAppStore((s) => s.activeWorkspace)
  const activeProject = useAppStore((s) => s.activeProject)

  const allTasks = config?.tasks ?? EMPTY_TASKS

  // ── Activity feed from DB ──
  const [activityEvents, setActivityEvents] = useState<SessionEvent[]>([])

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const events = await window.api.getActivityFeed(50)
        if (!cancelled) setActivityEvents(events)
      } catch {
        /* ignore */
      }
    }
    fetch()
    const interval = setInterval(fetch, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // ── Agent usage ──
  const [agentUsage, setAgentUsage] = useState<AgentUsageData[]>([])

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      try {
        const data = await window.api.getAgentUsage()
        if (!cancelled) setAgentUsage(data)
      } catch {
        /* ignore */
      }
    }
    fetch()
    const interval = setInterval(fetch, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Filter projects by workspace
  const workspaceProjects = useMemo(
    () => (config?.projects ?? []).filter((p) => (p.workspaceId ?? 'personal') === activeWorkspace),
    [config?.projects, activeWorkspace]
  )

  const workspaceProjectNames = useMemo(
    () => new Set(workspaceProjects.map((p) => p.name)),
    [workspaceProjects]
  )

  // ALL sessions in workspace (including idle), filtered by activeProject from sidebar
  const filteredSessions = useMemo(() => {
    const result: {
      id: string
      projectName: string
      agentType: AgentType
      displayName?: string
      status: string
    }[] = []
    for (const [id, t] of terminals) {
      if (!workspaceProjectNames.has(t.session.projectName)) continue
      if (activeProject && t.session.projectName !== activeProject) continue
      result.push({
        id,
        projectName: t.session.projectName,
        agentType: t.session.agentType,
        displayName: t.session.displayName,
        status: t.status
      })
    }
    return result
  }, [terminals, workspaceProjectNames, activeProject])

  // Filter headless by workspace + activeProject
  const filteredHeadless = useMemo(
    () =>
      headlessSessions.filter(
        (h) =>
          workspaceProjectNames.has(h.projectName) &&
          h.status === 'running' &&
          (!activeProject || h.projectName === activeProject)
      ),
    [headlessSessions, workspaceProjectNames, activeProject]
  )

  // Filter tasks by workspace + activeProject — in progress only
  const filteredTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          workspaceProjectNames.has(t.projectName) &&
          t.status === 'in_progress' &&
          (!activeProject || t.projectName === activeProject)
      ),
    [allTasks, workspaceProjectNames, activeProject]
  )

  // Workflow runs — count from actual activity events
  const workflowsToday = useMemo(() => {
    const wfEvents = activityEvents.filter((e) => e.eventType === 'workflow_run')
    let success = 0
    let error = 0
    for (const e of wfEvents) {
      if (e.metadata?.status === 'success') success++
      else if (e.metadata?.status === 'error') error++
    }
    return { total: wfEvents.length, success, error }
  }, [activityEvents])

  // Filter activity events by activeProject
  const filteredEvents = useMemo(() => {
    if (!activeProject) return activityEvents
    return activityEvents.filter((ev) => {
      const proj = ev.metadata?.projectName as string | undefined
      // Workflow runs don't have projectName — always show them
      if (ev.eventType === 'workflow_run') return true
      return proj === activeProject
    })
  }, [activityEvents, activeProject])

  const running = filteredSessions.filter((s) => s.status === 'running').length
  const waiting = filteredSessions.filter((s) => s.status === 'waiting').length
  const idle = filteredSessions.filter((s) => s.status === 'idle').length

  const setMainViewMode = useAppStore((s) => s.setMainViewMode)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)

  const handleActivityClick = useCallback(
    (event: SessionEvent) => {
      const meta = event.metadata ?? {}

      if (event.eventType === 'workflow_run') {
        const wfId = meta.workflowId as string | undefined
        if (wfId) {
          useAppStore.getState().setEditingWorkflowId(wfId)
          useAppStore.getState().setWorkflowEditorOpen(true)
        }
        return
      }

      if (event.sessionId) {
        const terminal = terminals.get(event.sessionId)
        if (terminal) {
          setMainViewMode('sessions')
          setFocusedTerminal(event.sessionId)
          return
        }
      }

      const projName = meta.projectName as string | undefined
      if (projName) {
        setMainViewMode('sessions')
        useAppStore.getState().setActiveProject(projName)
      }
    },
    [terminals, setMainViewMode, setFocusedTerminal]
  )

  const displayProjects = activeProject
    ? workspaceProjects.filter((p) => p.name === activeProject)
    : workspaceProjects

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="flex flex-col gap-4 max-w-[1200px] mx-auto">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <StatCard
            label="Total Sessions"
            value={filteredSessions.length}
            detail={
              [
                running > 0 ? `${running} running` : '',
                waiting > 0 ? `${waiting} waiting` : '',
                idle > 0 ? `${idle} idle` : ''
              ]
                .filter(Boolean)
                .join(', ') || 'none'
            }
            dotColor={running > 0 ? '#22c55e' : filteredSessions.length > 0 ? '#6b7280' : '#6b7280'}
            pulse={running > 0}
          />
          <StatCard
            label="Headless Agents"
            value={filteredHeadless.length}
            detail={
              filteredHeadless.length > 0
                ? `${filteredHeadless.length} running in background`
                : 'none active'
            }
            dotColor={filteredHeadless.length > 0 ? '#a855f7' : '#6b7280'}
            pulse={filteredHeadless.length > 0}
          />
          <StatCard
            label="Tasks In Progress"
            value={filteredTasks.length}
            detail={
              filteredTasks.length > 0
                ? `${filteredTasks.length} assigned to agents`
                : 'queue empty'
            }
            dotColor={filteredTasks.length > 0 ? '#eab308' : '#6b7280'}
          />
          <StatCard
            label="Workflow Runs"
            value={workflowsToday.total}
            detail={
              workflowsToday.total > 0
                ? [
                    workflowsToday.success > 0 ? `${workflowsToday.success} passed` : '',
                    workflowsToday.error > 0 ? `${workflowsToday.error} failed` : ''
                  ]
                    .filter(Boolean)
                    .join(', ')
                : 'no runs yet'
            }
            dotColor={
              workflowsToday.total > 0
                ? workflowsToday.error > 0
                  ? '#f97316'
                  : '#22c55e'
                : '#6b7280'
            }
          />
        </div>

        {/* Usage meters */}
        <UsageMeters usage={agentUsage} />

        {/* Bottom panels */}
        <div className="flex gap-3 min-h-[300px]">
          <ActivityFeed events={filteredEvents} onNavigate={handleActivityClick} />
          <div className="flex-1">
            <ActiveWorkPanel
              projects={displayProjects}
              sessions={filteredSessions}
              tasks={filteredTasks}
              headless={filteredHeadless}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
