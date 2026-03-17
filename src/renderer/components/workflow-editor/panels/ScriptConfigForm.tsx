import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, FileCode, Braces, ChevronRight, Settings2 } from 'lucide-react'
import { ScriptConfig, TriggerConfig } from '../../../../shared/types'
import { useAppStore } from '../../../stores'
import { TEMPLATE_VARIABLES, StepVariableGroup } from '../../../lib/template-vars'
import { VariableAutocomplete } from './VariableAutocomplete'
import { ProjectPicker } from '../../ProjectPicker'

interface Props {
  config: ScriptConfig
  onChange: (config: ScriptConfig) => void
  triggerType?: TriggerConfig['triggerType']
  stepGroups?: StepVariableGroup[]
}

const EMPTY_PROJECTS: import('../../../../shared/types').ProjectConfig[] = []

const SCRIPT_TYPES: { key: ScriptConfig['scriptType']; label: string; icon: typeof Terminal }[] = [
  { key: 'bash', label: 'Bash', icon: Terminal },
  { key: 'powershell', label: 'PowerShell', icon: Terminal },
  { key: 'python', label: 'Python', icon: FileCode },
  { key: 'node', label: 'Node', icon: Braces }
]

export function ScriptConfigForm({ config, onChange, triggerType, stepGroups = [] }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(!!config.args?.length)
  const projects = useAppStore((s) => s.config?.projects ?? EMPTY_PROJECTS)
  const isTaskTrigger = triggerType === 'taskCreated' || triggerType === 'taskStatusChanged'
  const hasTemplateVars = stepGroups.length > 0 || isTaskTrigger
  const contextVars = isTaskTrigger
    ? TEMPLATE_VARIABLES.filter(
        (v) =>
          v.category === 'task' || (v.category === 'trigger' && triggerType === 'taskStatusChanged')
      )
    : []

  return (
    <div className="space-y-5">
      {/* Script Type */}
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Type</label>
        <div className="flex gap-1.5 flex-wrap">
          {SCRIPT_TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onChange({ ...config, scriptType: key })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-md transition-colors
                         ${
                           config.scriptType === key
                             ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                             : 'bg-white/[0.04] text-gray-400 border border-white/[0.08] hover:bg-white/[0.08]'
                         }`}
            >
              <Icon size={12} className={config.scriptType === key ? '' : 'text-amber-400/60'} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Project / Working Directory */}
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">
          Working Directory
        </label>
        <ProjectPicker
          currentProject={config.projectName || ''}
          projects={projects}
          onChange={(name) => {
            const proj = projects.find((p) => p.name === name)
            if (proj) {
              onChange({
                ...config,
                projectName: proj.name,
                projectPath: proj.path,
                cwd: proj.path
              })
            }
          }}
          variant="form"
        />
        <p className="text-[11px] text-gray-500 mt-1">Script runs in this project's directory</p>
      </div>

      {/* Script Content */}
      <div>
        <label className="text-[13px] text-gray-400 font-medium block mb-2">Script</label>
        <VariableAutocomplete
          value={config.scriptContent || ''}
          onChange={(val) => onChange({ ...config, scriptContent: val })}
          placeholder={`Enter ${config.scriptType} script...`}
          rows={10}
          stepGroups={stepGroups}
          contextVars={contextVars}
          mono
        />
        {hasTemplateVars && (
          <p className="text-[11px] text-gray-500 mt-1">
            Type {'{{'} to insert step outputs or trigger variables
          </p>
        )}
      </div>

      {/* ── Advanced (collapsed) ── */}
      <div className="border-t border-white/[0.06] pt-4">
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
                {/* Arguments */}
                <div>
                  <label className="text-[13px] text-gray-400 font-medium block mb-2">
                    Arguments
                  </label>
                  <input
                    type="text"
                    value={(config.args || []).join(' ')}
                    onChange={(e) =>
                      onChange({ ...config, args: e.target.value.split(' ').filter(Boolean) })
                    }
                    placeholder="arg1 arg2 --flag"
                    className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                               text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Passed to the interpreter (e.g. $1, $2 in bash)
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
