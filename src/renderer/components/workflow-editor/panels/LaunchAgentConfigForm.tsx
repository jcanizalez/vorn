import { LaunchAgentConfig, AgentType } from '../../../../shared/types'
import { AgentIcon } from '../../AgentIcon'
import { useAppStore } from '../../../stores'

interface Props {
  config: LaunchAgentConfig
  onChange: (config: LaunchAgentConfig) => void
}

const AGENT_TYPES: AgentType[] = ['claude', 'copilot', 'codex', 'opencode', 'gemini']

export function LaunchAgentConfigForm({ config, onChange }: Props) {
  const projects = useAppStore((s) => s.config?.projects || [])
  const tasks = useAppStore((s) => s.config?.tasks || [])
  const projectTasks = tasks.filter((t) => t.projectName === config.projectName && t.status === 'todo')

  const promptSource = config.taskId ? 'task' : config.taskFromQueue ? 'queue' : 'inline'

  return (
    <div className="space-y-4">
      {/* Agent Type */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Agent
        </label>
        <div className="flex gap-1.5">
          {AGENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onChange({ ...config, agentType: type })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-md transition-colors capitalize
                         ${config.agentType === type
                           ? 'bg-white/[0.12] text-white border border-white/[0.15]'
                           : 'bg-white/[0.04] text-gray-500 border border-white/[0.08] hover:bg-white/[0.08]'}`}
            >
              <AgentIcon agentType={type} size={14} />
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Project */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Project
        </label>
        <select
          value={config.projectName}
          onChange={(e) => {
            const proj = projects.find((p) => p.name === e.target.value)
            if (proj) onChange({ ...config, projectName: proj.name, projectPath: proj.path })
          }}
          className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                     text-white focus:outline-none focus:border-blue-500/50 appearance-none"
        >
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Display Name */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Tab Name
        </label>
        <input
          type="text"
          value={config.displayName || ''}
          onChange={(e) => onChange({ ...config, displayName: e.target.value || undefined })}
          placeholder="Optional display name"
          className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                     text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Branch */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Branch
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={config.branch || ''}
            onChange={(e) => onChange({ ...config, branch: e.target.value || undefined })}
            placeholder="Optional branch"
            className="flex-1 px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
          />
          <label className="flex items-center gap-1.5 text-[12px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={config.useWorktree || false}
              onChange={(e) => onChange({ ...config, useWorktree: e.target.checked || undefined })}
              className="rounded"
            />
            Worktree
          </label>
        </div>
      </div>

      {/* Prompt Source */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Prompt Source
        </label>
        <div className="flex gap-1.5 mb-2">
          {(['inline', 'task', 'queue'] as const).map((source) => (
            <button
              key={source}
              onClick={() => {
                if (source === 'inline') onChange({ ...config, taskId: undefined, taskFromQueue: undefined })
                else if (source === 'task') onChange({ ...config, prompt: undefined, taskFromQueue: undefined, taskId: projectTasks[0]?.id })
                else onChange({ ...config, prompt: undefined, taskId: undefined, taskFromQueue: true })
              }}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors capitalize
                         ${promptSource === source
                           ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                           : 'bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/[0.1]'}`}
            >
              {source}
            </button>
          ))}
        </div>

        {promptSource === 'inline' && (
          <textarea
            value={config.prompt || ''}
            onChange={(e) => onChange({ ...config, prompt: e.target.value || undefined })}
            placeholder="Enter prompt..."
            rows={4}
            className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50
                       resize-none"
          />
        )}

        {promptSource === 'task' && (
          <select
            value={config.taskId || ''}
            onChange={(e) => onChange({ ...config, taskId: e.target.value || undefined })}
            className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white focus:outline-none focus:border-blue-500/50 appearance-none"
          >
            <option value="">Select task...</option>
            {projectTasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        )}

        {promptSource === 'queue' && (
          <p className="text-[12px] text-gray-500">
            Will auto-pick the next todo task from {config.projectName || 'the project'} queue at runtime.
          </p>
        )}
      </div>

      {/* Prompt Delay */}
      {promptSource === 'inline' && (
        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
            Prompt Delay (ms)
          </label>
          <input
            type="number"
            value={config.promptDelayMs || ''}
            onChange={(e) => onChange({ ...config, promptDelayMs: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="0"
            className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      )}
    </div>
  )
}
