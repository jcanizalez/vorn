import { ConditionConfig, ConditionOperator, TriggerConfig } from '../../../../shared/types'
import { TEMPLATE_VARIABLES, StepVariableGroup } from '../../../lib/template-vars'
import { VariableAutocomplete } from './VariableAutocomplete'

interface Props {
  config: ConditionConfig
  onChange: (config: ConditionConfig) => void
  triggerType?: TriggerConfig['triggerType']
  stepGroups: StepVariableGroup[]
}

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'not contains' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' }
]

const hiddenValueOperators: ConditionOperator[] = ['isEmpty', 'isNotEmpty']

export function ConditionConfigForm({ config, onChange, triggerType, stepGroups }: Props) {
  const contextVars = TEMPLATE_VARIABLES.filter((v) => {
    if (v.group === 'task') {
      return triggerType === 'taskCreated' || triggerType === 'taskStatusChanged'
    }
    if (v.group === 'trigger') {
      return triggerType === 'taskStatusChanged'
    }
    return false
  })

  return (
    <div className="space-y-4">
      {/* Variable */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Variable
        </label>
        <VariableAutocomplete
          value={config.variable || ''}
          onChange={(val) => onChange({ ...config, variable: val })}
          placeholder="e.g. {{steps.build.status}}"
          rows={1}
          stepGroups={stepGroups}
          contextVars={contextVars}
          mono
        />
      </div>

      {/* Operator */}
      <div>
        <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
          Operator
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {OPERATORS.map((op) => (
            <button
              key={op.value}
              onClick={() => onChange({ ...config, operator: op.value })}
              className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-all ${
                config.operator === op.value
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.12] hover:text-gray-300'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Value */}
      {!hiddenValueOperators.includes(config.operator) && (
        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-medium block mb-1.5">
            Value
          </label>
          <VariableAutocomplete
            value={config.value || ''}
            onChange={(val) => onChange({ ...config, value: val })}
            placeholder="Compare against..."
            rows={1}
            stepGroups={stepGroups}
            contextVars={contextVars}
            mono
          />
        </div>
      )}

      {/* Preview */}
      {config.variable && (
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Evaluates</div>
          <div className="text-[11px] text-gray-400 font-mono truncate">
            {config.variable} {OPERATORS.find((o) => o.value === config.operator)?.label || ''}
            {!hiddenValueOperators.includes(config.operator) && config.value
              ? ` "${config.value}"`
              : ''}
          </div>
        </div>
      )}
    </div>
  )
}
