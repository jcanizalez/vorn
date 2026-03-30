import { X, Trash2, Zap, Play, Terminal, GitFork } from 'lucide-react'
import {
  WorkflowNode,
  TriggerConfig,
  LaunchAgentConfig,
  ScriptConfig,
  ConditionConfig
} from '../../../../shared/types'

const NODE_TYPE_CONFIG: Record<
  WorkflowNode['type'],
  { icon: typeof Zap; label: string; color: string; bg: string }
> = {
  trigger: { icon: Zap, label: 'Trigger', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  launchAgent: { icon: Play, label: 'Agent', color: 'text-green-400', bg: 'bg-green-500/10' },
  script: { icon: Terminal, label: 'Script', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  condition: { icon: GitFork, label: 'Condition', color: 'text-purple-400', bg: 'bg-purple-500/10' }
}
import { TriggerConfigForm } from './TriggerConfigForm'
import { LaunchAgentConfigForm } from './LaunchAgentConfigForm'
import { ScriptConfigForm } from './ScriptConfigForm'
import { ConditionConfigForm } from './ConditionConfigForm'
import type { StepVariableGroup } from '../../../lib/template-vars'

interface Props {
  node: WorkflowNode
  allNodes?: WorkflowNode[]
  onChange: (nodeId: string, config: WorkflowNode['config']) => void
  onLabelChange: (nodeId: string, label: string) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
  triggerType?: TriggerConfig['triggerType']
  stepGroups?: StepVariableGroup[]
}

export function NodeConfigPanel({
  node,
  allNodes,
  onChange,
  onLabelChange,
  onDelete,
  onClose,
  triggerType,
  stepGroups
}: Props) {
  return (
    <div className="w-[420px] border-l border-white/[0.08] bg-[#1e1e22] flex flex-col h-full overflow-hidden titlebar-no-drag">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
        {(() => {
          const tc = NODE_TYPE_CONFIG[node.type]
          const Icon = tc.icon
          return (
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded flex items-center justify-center ${tc.bg}`}>
                <Icon size={13} className={tc.color} />
              </div>
              <span className="text-[13px] font-medium text-white">{tc.label} Config</span>
            </div>
          )
        })()}
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white p-1 rounded-md transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Label */}
        <div>
          <label className="text-[13px] text-gray-400 font-medium block mb-2">Label</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => onLabelChange(node.id, e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-white/[0.06] border border-white/[0.1] rounded-md
                       text-white focus:outline-none focus:border-blue-500/50"
          />
          {node.slug && node.type !== 'trigger' && (
            <p className="text-[10px] text-gray-600 mt-1 font-mono">
              Ref: {`{{steps.${node.slug}.output}}`}
            </p>
          )}
        </div>

        {/* Type-specific config */}
        {node.type === 'trigger' && (
          <TriggerConfigForm
            config={node.config as TriggerConfig}
            onChange={(config) => onChange(node.id, config)}
          />
        )}

        {node.type === 'launchAgent' && (
          <LaunchAgentConfigForm
            config={node.config as LaunchAgentConfig}
            onChange={(config) => onChange(node.id, config)}
            triggerType={triggerType}
            stepGroups={stepGroups}
            currentNodeId={node.id}
            allNodes={allNodes}
          />
        )}

        {node.type === 'script' && (
          <ScriptConfigForm
            config={node.config as ScriptConfig}
            onChange={(config) => onChange(node.id, config)}
            triggerType={triggerType}
            stepGroups={stepGroups}
          />
        )}

        {node.type === 'condition' && (
          <ConditionConfigForm
            config={node.config as ConditionConfig}
            onChange={(config) => onChange(node.id, config)}
            triggerType={triggerType}
            stepGroups={stepGroups || []}
          />
        )}
      </div>

      {/* Delete button (not for trigger) */}
      {node.type !== 'trigger' && (
        <div className="px-5 py-4 border-t border-white/[0.08]">
          <button
            onClick={() => onDelete(node.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px]
                       text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20
                       rounded-md transition-colors"
          >
            <Trash2 size={13} />
            Remove Action
          </button>
        </div>
      )}
    </div>
  )
}
