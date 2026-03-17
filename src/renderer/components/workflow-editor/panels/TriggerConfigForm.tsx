import { Zap, Clock, RefreshCw, ListPlus, ArrowRightLeft } from 'lucide-react'
import { useAppStore } from '../../../stores'
import { TriggerConfig, TaskStatus } from '../../../../shared/types'

interface Props {
  config: TriggerConfig
  onChange: (config: TriggerConfig) => void
}

const CRON_PRESETS = [
  { label: 'Weekdays 9am', value: '0 9 * * 1-5' },
  { label: 'Daily 9am', value: '0 9 * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 30min', value: '*/30 * * * *' },
  { label: 'Weekly (Mon 9am)', value: '0 9 * * 1' }
]

const TRIGGER_TYPES = [
  {
    type: 'manual' as const,
    label: 'Manual',
    icon: Zap,
    accent: 'blue' as const,
    hint: 'Run this workflow manually from the play button'
  },
  {
    type: 'once' as const,
    label: 'Once',
    icon: Clock,
    accent: 'blue' as const,
    hint: 'Runs once at the scheduled time'
  },
  {
    type: 'recurring' as const,
    label: 'Recurring',
    icon: RefreshCw,
    accent: 'blue' as const,
    hint: 'Runs on a repeating schedule'
  },
  {
    type: 'taskCreated' as const,
    label: 'Task Created',
    icon: ListPlus,
    accent: 'purple' as const,
    hint: 'Fires when a new task is added to a project'
  },
  {
    type: 'taskStatusChanged' as const,
    label: 'Status Change',
    icon: ArrowRightLeft,
    accent: 'purple' as const,
    hint: "Fires when a task's status changes"
  }
]

const ACCENT_STYLES = {
  blue: {
    active: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    icon: 'text-blue-400'
  },
  purple: {
    active: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    icon: 'text-purple-400'
  }
}

const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' }
]

function switchTriggerType(type: TriggerConfig['triggerType']): TriggerConfig {
  switch (type) {
    case 'manual':
      return { triggerType: 'manual' }
    case 'once':
      return { triggerType: 'once', runAt: new Date().toISOString() }
    case 'recurring':
      return { triggerType: 'recurring', cron: '0 9 * * *' }
    case 'taskCreated':
      return { triggerType: 'taskCreated' }
    case 'taskStatusChanged':
      return { triggerType: 'taskStatusChanged' }
  }
}

const EMPTY_PROJECTS: import('../../../../shared/types').ProjectConfig[] = []

export function TriggerConfigForm({ config, onChange }: Props) {
  const projects = useAppStore((s) => s.config?.projects ?? EMPTY_PROJECTS)

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Trigger Type</label>
        <div className="flex flex-wrap gap-1.5">
          {TRIGGER_TYPES.map(({ type, label, icon: Icon, accent }) => {
            const isActive = config.triggerType === type
            const styles = ACCENT_STYLES[accent]
            return (
              <button
                key={type}
                onClick={() => onChange(switchTriggerType(type))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-md transition-colors
                           ${
                             isActive
                               ? styles.active
                               : 'bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/[0.1]'
                           }`}
              >
                <Icon size={12} className={isActive ? '' : styles.icon} />
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-500 mt-1.5">
          {TRIGGER_TYPES.find((t) => t.type === config.triggerType)?.hint}
        </p>
      </div>

      {config.triggerType === 'once' && (
        <div>
          <label className="text-[13px] text-gray-400 font-medium block mb-2">Run At</label>
          <input
            type="datetime-local"
            value={config.runAt ? new Date(config.runAt).toISOString().slice(0, 16) : ''}
            onChange={(e) =>
              onChange({ triggerType: 'once', runAt: new Date(e.target.value).toISOString() })
            }
            className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white focus:outline-none focus:border-blue-500/50
                       [color-scheme:dark]"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Local time. The workflow runs once at this time.
          </p>
        </div>
      )}

      {config.triggerType === 'recurring' && (
        <>
          <div>
            <label className="text-[13px] text-gray-400 font-medium block mb-2">Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => onChange({ ...config, cron: preset.value })}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors
                             ${
                               config.cron === preset.value
                                 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                 : 'bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/[0.1]'
                             }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[13px] text-gray-400 font-medium block mb-2">
              Cron Expression
            </label>
            <input
              type="text"
              value={config.cron}
              onChange={(e) => onChange({ ...config, cron: e.target.value })}
              placeholder="* * * * *"
              className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                         text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">min hour day month weekday</p>
          </div>
          <div>
            <label className="text-[13px] text-gray-400 font-medium block mb-2">Timezone</label>
            <input
              type="text"
              value={config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={(e) => onChange({ ...config, timezone: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                         text-white focus:outline-none focus:border-blue-500/50"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              IANA timezone — auto-detected from your system
            </p>
          </div>
        </>
      )}

      {config.triggerType === 'taskCreated' && (
        <ProjectFilterSelect
          value={config.projectFilter}
          onChange={(projectFilter) => onChange({ ...config, projectFilter })}
          projects={projects}
        />
      )}

      {config.triggerType === 'taskStatusChanged' && (
        <>
          <ProjectFilterSelect
            value={config.projectFilter}
            onChange={(projectFilter) => onChange({ ...config, projectFilter })}
            projects={projects}
          />
          <div>
            <label className="text-[13px] text-gray-400 font-medium block mb-2">From Status</label>
            <StatusSelect
              value={config.fromStatus}
              onChange={(fromStatus) => onChange({ ...config, fromStatus })}
              placeholder="Any status"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Filter by previous status (blank = any)
            </p>
          </div>
          <div>
            <label className="text-[13px] text-gray-400 font-medium block mb-2">To Status</label>
            <StatusSelect
              value={config.toStatus}
              onChange={(toStatus) => onChange({ ...config, toStatus })}
              placeholder="Any status"
            />
            <p className="text-[11px] text-gray-500 mt-1">Filter by new status (blank = any)</p>
          </div>
        </>
      )}
    </div>
  )
}

function ProjectFilterSelect({
  value,
  onChange,
  projects
}: {
  value?: string
  onChange: (value?: string) => void
  projects: { name: string }[]
}) {
  return (
    <div>
      <label className="text-[13px] text-gray-400 font-medium block mb-2">Project Filter</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                   text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-gray-500 mt-1">Only trigger for tasks in this project</p>
    </div>
  )
}

function StatusSelect({
  value,
  onChange,
  placeholder
}: {
  value?: TaskStatus
  onChange: (value?: TaskStatus) => void
  placeholder: string
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange((e.target.value || undefined) as TaskStatus | undefined)}
      className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                 text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
    >
      <option value="">{placeholder}</option>
      {TASK_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  )
}
