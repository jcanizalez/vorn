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
  { label: 'Weekly (Mon 9am)', value: '0 9 * * 1' },
]

const TRIGGER_TYPES = [
  { type: 'manual' as const, label: 'Manual' },
  { type: 'once' as const, label: 'Once' },
  { type: 'recurring' as const, label: 'Recurring' },
  { type: 'taskCreated' as const, label: 'Task Created' },
  { type: 'taskStatusChanged' as const, label: 'Status Change' },
]

const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

function switchTriggerType(type: TriggerConfig['triggerType']): TriggerConfig {
  switch (type) {
    case 'manual': return { triggerType: 'manual' }
    case 'once': return { triggerType: 'once', runAt: new Date().toISOString() }
    case 'recurring': return { triggerType: 'recurring', cron: '0 9 * * *' }
    case 'taskCreated': return { triggerType: 'taskCreated' }
    case 'taskStatusChanged': return { triggerType: 'taskStatusChanged' }
  }
}

export function TriggerConfigForm({ config, onChange }: Props) {
  const projects = useAppStore((s) => s.config?.projects || [])

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Trigger Type
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TRIGGER_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => onChange(switchTriggerType(type))}
              className={`px-3 py-1.5 text-[12px] rounded-md transition-colors
                         ${config.triggerType === type
                           ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                           : 'bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/[0.1]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {config.triggerType === 'once' && (
        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
            Run At
          </label>
          <input
            type="datetime-local"
            value={config.runAt ? new Date(config.runAt).toISOString().slice(0, 16) : ''}
            onChange={(e) => onChange({ triggerType: 'once', runAt: new Date(e.target.value).toISOString() })}
            className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white focus:outline-none focus:border-blue-500/50
                       [color-scheme:dark]"
          />
        </div>
      )}

      {config.triggerType === 'recurring' && (
        <>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
              Preset
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => onChange({ ...config, cron: preset.value })}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors
                             ${config.cron === preset.value
                               ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                               : 'bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/[0.1]'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
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
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
              Timezone
            </label>
            <input
              type="text"
              value={config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
              onChange={(e) => onChange({ ...config, timezone: e.target.value })}
              className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                         text-white focus:outline-none focus:border-blue-500/50"
            />
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
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
              From Status
            </label>
            <StatusSelect
              value={config.fromStatus}
              onChange={(fromStatus) => onChange({ ...config, fromStatus })}
              placeholder="Any status"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
              To Status
            </label>
            <StatusSelect
              value={config.toStatus}
              onChange={(toStatus) => onChange({ ...config, toStatus })}
              placeholder="Any status"
            />
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
      <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
        Project Filter
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                   text-white focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
      >
        <option value="">All projects</option>
        {projects.map((p) => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
      </select>
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
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  )
}
