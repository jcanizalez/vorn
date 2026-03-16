import { GitBranch } from 'lucide-react'
import type { ConditionConfig, ConditionOperator } from '../../../../shared/types'

interface Props {
  label: string
  config: ConditionConfig
  selected?: boolean
  executionStatus?: string
  onClick: () => void
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: '=',
  notEquals: '!=',
  contains: 'contains',
  notContains: 'not contains',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty'
}

export function ConditionNode({ label, config, selected, executionStatus, onClick }: Props) {
  const hasConfig = config.variable && config.operator

  const preview = hasConfig
    ? `${config.variable} ${OPERATOR_LABELS[config.operator]}${
        config.operator !== 'isEmpty' && config.operator !== 'isNotEmpty' && config.value
          ? ` "${config.value}"`
          : ''
      }`
    : undefined

  const statusColor =
    executionStatus === 'running'
      ? 'border-yellow-500'
      : executionStatus === 'success'
        ? 'border-green-500'
        : executionStatus === 'error'
          ? 'border-red-500'
          : executionStatus === 'skipped'
            ? 'border-gray-600'
            : selected
              ? 'border-blue-500'
              : 'border-white/[0.12]'

  const statusBg =
    executionStatus === 'running'
      ? 'bg-yellow-500/10'
      : executionStatus === 'success'
        ? 'bg-green-500/10'
        : executionStatus === 'error'
          ? 'bg-red-500/10'
          : executionStatus === 'skipped'
            ? 'bg-gray-500/5'
            : selected
              ? 'bg-blue-500/10'
              : 'bg-[#232328]'

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`px-4 py-3 rounded-lg border-2 w-[280px] transition-colors cursor-pointer
                  ${statusColor} ${statusBg}
                  hover:border-white/[0.2]`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: '#a855f720' }}
        >
          <GitBranch size={16} style={{ color: '#a855f7' }} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white truncate">{label}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {hasConfig ? OPERATOR_LABELS[config.operator] : 'Not configured'}
          </div>
        </div>
      </div>
      {preview && (
        <div className="mt-2 text-[11px] text-gray-600 truncate border-t border-white/[0.06] pt-2 font-mono">
          {preview.length > 60 ? preview.slice(0, 60) + '...' : preview}
        </div>
      )}
    </div>
  )
}
