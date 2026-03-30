import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export function WorkflowSubGroup({
  label,
  icon,
  count,
  defaultCollapsed,
  children
}: {
  label: string
  icon: React.ReactNode
  count: number
  defaultCollapsed: boolean
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <div className="mt-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 px-2 py-1 w-full text-left hover:bg-white/[0.04] rounded-md transition-colors"
      >
        <ChevronRight
          size={10}
          strokeWidth={2}
          className={`text-gray-600 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        />
        {icon}
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {count > 0 && (
          <span className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="ml-2 space-y-0.5">
          {count === 0 ? <p className="text-[11px] text-gray-600 py-0.5 pl-2">None</p> : children}
        </div>
      )}
    </div>
  )
}
