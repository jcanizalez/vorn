import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores'
import { TaskStatusFilter } from '../stores/types'
import { TaskViewMode } from '../../shared/types'

/* ── Dropdown menu primitive (same as GridToolbar) ──────────── */

interface MenuOption<T extends string> {
  value: T
  label: string
  dot?: string
}

interface DropdownProps<T extends string> {
  icon: React.ReactNode
  options: MenuOption<T>[]
  value: T
  onChange: (v: T) => void
  title: string
  label: string
}

function Dropdown<T extends string>({
  icon,
  options,
  value,
  onChange,
  title,
  label
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const active = options.find((o) => o.value === value)
  const activeLabel = active?.label ?? ''
  const activeDot = active?.dot
  const isDefault = value === options[0].value

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
          isDefault
            ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
            : 'text-white bg-white/[0.08] hover:bg-white/[0.12]'
        }`}
        title={title}
      >
        {icon}
        {activeDot && <span className={`w-1.5 h-1.5 rounded-full ${activeDot} shrink-0`} />}
        <span>{activeLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-50"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px]
                        border border-white/[0.08] rounded-lg shadow-xl overflow-hidden"
          style={{ background: '#1a1a1e' }}
        >
          <div className="px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
            {label}
          </div>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                value === opt.value
                  ? 'text-white bg-white/[0.06]'
                  : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {value === opt.value && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {value !== opt.value && <span className="w-3" />}
              {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot} shrink-0`} />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Options ─────────────────────────────────────────────────── */

const TASK_STATUS_OPTIONS: MenuOption<TaskStatusFilter>[] = [
  { value: 'all', label: 'All', dot: 'bg-gray-400' },
  { value: 'todo', label: 'Todo', dot: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'in_review', label: 'In Review', dot: 'bg-purple-500' },
  { value: 'done', label: 'Done', dot: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', dot: 'bg-gray-600' }
]

/* ── Icons ───────────────────────────────────────────────────── */

const FilterIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)

const ListIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

const KanbanIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
)

/* ── Component ───────────────────────────────────────────────── */

export function TaskToolbar() {
  const taskStatusFilter = useAppStore((s) => s.taskStatusFilter)
  const setTaskStatusFilter = useAppStore((s) => s.setTaskStatusFilter)
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const taskViewMode = (config?.defaults?.taskViewMode ?? 'list') as TaskViewMode

  const setViewMode = (mode: TaskViewMode): void => {
    if (!config || taskViewMode === mode) return
    const updated = {
      ...config,
      defaults: { ...config.defaults, taskViewMode: mode }
    }
    window.api.saveConfig(updated)
    setConfig(updated)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status filter */}
      <Dropdown
        icon={FilterIcon}
        options={TASK_STATUS_OPTIONS}
        value={taskStatusFilter}
        onChange={setTaskStatusFilter}
        title="Filter by status"
        label="Status"
      />

      {/* View toggle — pill segmented control */}
      <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5">
        <button
          onClick={() => setViewMode('list')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            taskViewMode === 'list'
              ? 'bg-white/[0.1] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {ListIcon}
          <span>List</span>
        </button>
        <button
          onClick={() => setViewMode('kanban')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            taskViewMode === 'kanban'
              ? 'bg-white/[0.1] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {KanbanIcon}
          <span>Board</span>
        </button>
      </div>
    </div>
  )
}
