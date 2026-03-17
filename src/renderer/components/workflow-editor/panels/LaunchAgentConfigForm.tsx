import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  Settings2,
  FileText,
  ClipboardList,
  ListOrdered,
  GitBranch,
  FolderGit2,
  EyeOff
} from 'lucide-react'
import { LaunchAgentConfig, AgentType, TriggerConfig } from '../../../../shared/types'
import { useAppStore } from '../../../stores'
import { TEMPLATE_VARIABLES, StepVariableGroup } from '../../../lib/template-vars'
import { useAgentInstallStatus } from '../../../hooks/useAgentInstallStatus'
import { VariableAutocomplete } from './VariableAutocomplete'
import { ProjectPicker } from '../../ProjectPicker'
import { AgentPicker } from '../../AgentPicker'
import { RichMarkdownEditor } from '../../rich-editor/RichMarkdownEditor'

interface Props {
  config: LaunchAgentConfig
  onChange: (config: LaunchAgentConfig) => void
  triggerType?: TriggerConfig['triggerType']
  stepGroups?: StepVariableGroup[]
}

const EMPTY_PROJECTS: import('../../../../shared/types').ProjectConfig[] = []
const EMPTY_TASKS: import('../../../../shared/types').TaskConfig[] = []

const PROMPT_SOURCES = [
  { key: 'inline' as const, label: 'Inline', icon: FileText },
  { key: 'task' as const, label: 'Task', icon: ClipboardList },
  { key: 'queue' as const, label: 'Queue', icon: ListOrdered }
]

export function LaunchAgentConfigForm({ config, onChange, triggerType, stepGroups = [] }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(!!config.args?.length)
  const projects = useAppStore((s) => s.config?.projects ?? EMPTY_PROJECTS)
  const tasks = useAppStore((s) => s.config?.tasks ?? EMPTY_TASKS)
  const { status: installStatus } = useAgentInstallStatus()
  const projectTasks = tasks.filter(
    (t) => t.projectName === config.projectName && t.status === 'todo'
  )

  const promptSource = config.taskId ? 'task' : config.taskFromQueue ? 'queue' : 'inline'
  const isTaskTrigger = triggerType === 'taskCreated' || triggerType === 'taskStatusChanged'
  const hasTemplateVars = stepGroups.length > 0 || isTaskTrigger
  const hasBranch = !!(config.branch && config.branch.trim())
  const isHeadless = config.headless !== false

  const contextVars = isTaskTrigger
    ? TEMPLATE_VARIABLES.filter(
        (v) =>
          v.category === 'task' || (v.category === 'trigger' && triggerType === 'taskStatusChanged')
      )
    : []

  return (
    <div className="space-y-5">
      {/* ── What to Run ── */}

      {/* Agent */}
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Agent</label>
        <AgentPicker
          currentAgent={config.agentType}
          onChange={(agent: AgentType) => onChange({ ...config, agentType: agent })}
          installStatus={installStatus}
          variant="form"
        />
      </div>

      {/* Project */}
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Project</label>
        <ProjectPicker
          currentProject={config.projectName}
          projects={projects}
          onChange={(name) => {
            const proj = projects.find((p) => p.name === name)
            if (proj) onChange({ ...config, projectName: proj.name, projectPath: proj.path })
          }}
          variant="form"
        />
      </div>

      {/* Prompt Source */}
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Prompt</label>
        <div className="flex gap-1.5 mb-2">
          {PROMPT_SOURCES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                if (key === 'inline')
                  onChange({ ...config, taskId: undefined, taskFromQueue: undefined })
                else if (key === 'task')
                  onChange({
                    ...config,
                    prompt: undefined,
                    taskFromQueue: undefined,
                    taskId: projectTasks[0]?.id
                  })
                else
                  onChange({ ...config, prompt: undefined, taskId: undefined, taskFromQueue: true })
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-colors
                         ${
                           promptSource === key
                             ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                             : 'bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/[0.1]'
                         }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {promptSource === 'inline' && (
          <>
            {hasTemplateVars ? (
              <VariableAutocomplete
                value={config.prompt || ''}
                onChange={(val) => onChange({ ...config, prompt: val || undefined })}
                placeholder="Enter prompt..."
                rows={4}
                stepGroups={stepGroups}
                contextVars={contextVars}
              />
            ) : (
              <RichMarkdownEditor
                value={config.prompt || ''}
                onChange={(val) => onChange({ ...config, prompt: val || undefined })}
                placeholder="Enter prompt..."
                className="min-h-[100px]"
              />
            )}
          </>
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
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}

        {promptSource === 'queue' && (
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Auto-picks the next todo task from{' '}
            <span className="text-gray-400">{config.projectName || 'the project'}</span> at runtime.
          </p>
        )}
      </div>

      {/* ── Git & Branch ── */}
      <div className="border border-white/[0.06] rounded-lg p-3 space-y-3">
        <div className="text-[13px] text-gray-400 font-medium flex items-center gap-1.5">
          <GitBranch size={11} />
          Git &amp; Branch
        </div>

        {/* Branch input */}
        <div>
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] border border-white/[0.1] rounded-md">
            <GitBranch size={12} strokeWidth={2} className="text-gray-500 shrink-0" />
            <input
              type="text"
              value={config.branch || ''}
              onChange={(e) => {
                const branch = e.target.value || undefined
                const updates: Partial<LaunchAgentConfig> = { branch }
                // Auto-clear worktree when branch is cleared
                if (!branch) updates.useWorktree = undefined
                onChange({ ...config, ...updates })
              }}
              placeholder="feature/my-branch"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-white placeholder-gray-600
                         focus:outline-none border-none px-0"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Checks out this branch before launching</p>
        </div>

        {/* Worktree toggle — mirrors NewAgentDialog:445-483 */}
        <button
          onClick={() => {
            if (hasBranch) {
              onChange({ ...config, useWorktree: config.useWorktree ? undefined : true })
            }
          }}
          disabled={!hasBranch}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border transition-all ${
            !hasBranch
              ? 'border-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed'
              : config.useWorktree
                ? 'border-amber-500/20 bg-amber-500/[0.06]'
                : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.1]'
          }`}
        >
          <div
            className={`w-7 h-[16px] rounded-full transition-colors relative shrink-0 ${
              config.useWorktree ? 'bg-amber-500' : 'bg-white/[0.1]'
            }`}
          >
            <div
              className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-transform ${
                config.useWorktree ? 'translate-x-[13px]' : 'translate-x-[2px]'
              }`}
            />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <FolderGit2
                size={12}
                className={config.useWorktree ? 'text-amber-400' : 'text-gray-500'}
              />
              <span
                className={`text-[12px] ${config.useWorktree ? 'text-amber-300' : 'text-gray-300'}`}
              >
                Worktree
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {hasBranch
                ? "Isolated directory — won't affect the main working tree"
                : 'Set a branch name to enable'}
            </p>
          </div>
        </button>
      </div>

      {/* ── Execution ── */}
      <div className="border border-white/[0.06] rounded-lg p-3 space-y-3">
        <div className="text-[13px] text-gray-400 font-medium flex items-center gap-1.5">
          Execution
        </div>

        {/* Headless toggle — matches worktree toggle pattern */}
        <button
          onClick={() => onChange({ ...config, headless: isHeadless ? false : true })}
          disabled={!!config.remoteHostId}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border transition-all ${
            config.remoteHostId
              ? 'border-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed'
              : isHeadless
                ? 'border-blue-500/20 bg-blue-500/[0.06]'
                : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.1]'
          }`}
        >
          <div
            className={`w-7 h-[16px] rounded-full transition-colors relative shrink-0 ${
              isHeadless ? 'bg-blue-500' : 'bg-white/[0.1]'
            }`}
          >
            <div
              className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-transform ${
                isHeadless ? 'translate-x-[13px]' : 'translate-x-[2px]'
              }`}
            />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <EyeOff size={12} className={isHeadless ? 'text-blue-400' : 'text-gray-500'} />
              <span className={`text-[12px] ${isHeadless ? 'text-blue-300' : 'text-gray-300'}`}>
                Headless
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isHeadless
                ? 'Runs in background. Waits for completion before next step.'
                : 'Opens a terminal tab. Step completes immediately.'}
            </p>
          </div>
        </button>

        {/* Tab Name — only when not headless */}
        {!isHeadless && (
          <div>
            <label className="text-[13px] text-gray-400 font-medium block mb-2">Tab Name</label>
            <input
              type="text"
              value={config.displayName || ''}
              onChange={(e) => onChange({ ...config, displayName: e.target.value || undefined })}
              placeholder={config.projectName || 'Uses project name'}
              className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                         text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <p className="text-[11px] text-gray-500 mt-1">Label for the terminal tab</p>
          </div>
        )}
      </div>

      {/* ── Advanced (collapsed) ── */}
      <div>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-400
                     transition-colors uppercase tracking-wider font-medium w-full"
        >
          <ChevronRight
            size={12}
            className={`transition-transform duration-200 ${advancedOpen ? 'rotate-90' : ''}`}
          />
          <Settings2 size={11} />
          Advanced
        </button>

        <AnimatePresence initial={false}>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-3">
                {/* Extra Arguments */}
                <div>
                  <label className="text-[13px] text-gray-400 font-medium block mb-2">
                    Extra Arguments
                  </label>
                  <input
                    type="text"
                    value={(config.args || []).join(' ')}
                    onChange={(e) => {
                      const args = e.target.value.trim()
                        ? e.target.value.trim().split(/\s+/)
                        : undefined
                      onChange({ ...config, args })
                    }}
                    placeholder="e.g. --dangerously-skip-permissions"
                    className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                               text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    CLI flags passed to the agent, replacing project defaults
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
