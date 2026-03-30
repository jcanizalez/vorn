import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores'
import { TaskStatusFilter } from '../stores/types'
import { TaskViewMode } from '../../shared/types'
import { SlidersHorizontal } from 'lucide-react'
import { Tooltip } from './Tooltip'
import { OptionRow } from './OptionRow'

const isMac = navigator.platform.toUpperCase().includes('MAC')

/* ── Options ─────────────────────────────────────────────────── */

const TASK_STATUS_OPTIONS: { value: TaskStatusFilter; label: string; dot: string }[] = [
  { value: 'all', label: 'All', dot: 'bg-gray-400' },
  { value: 'todo', label: 'Todo', dot: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'in_review', label: 'In Review', dot: 'bg-purple-500' },
  { value: 'done', label: 'Done', dot: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', dot: 'bg-gray-600' }
]

/* ── Icons ───────────────────────────────────────────────────── */

const ListIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)

const KanbanIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
    <path d="M15 3v18" />
  </svg>
)

/* ── Component ───────────────────────────────────────────────── */

export function TaskToolbar() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const hasActiveFilters = taskStatusFilter !== 'all' || taskViewMode !== 'list'

  const toggle = useCallback(() => setOpen((o) => !o), [])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  useEffect(() => {
    window.addEventListener('toggle-view-options', toggle)
    return () => window.removeEventListener('toggle-view-options', toggle)
  }, [toggle])

  return (
    <div className="relative flex items-center" ref={ref}>
      <Tooltip label="View options" shortcut={`${isMac ? '⌘' : 'Ctrl+'}J`} position="bottom">
        <button
          onClick={toggle}
          className={`relative p-1 rounded-md transition-colors ${
            open
              ? 'text-white bg-white/[0.1]'
              : hasActiveFilters
                ? 'text-white bg-white/[0.08] hover:bg-white/[0.12]'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} />
          {hasActiveFilters && !open && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </Tooltip>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-[200px]
                     border border-white/[0.08] rounded-lg shadow-xl overflow-hidden"
          style={{ background: '#1a1a1e' }}
        >
          {/* Status section */}
          <div className="py-1.5">
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider">
              Status
            </div>
            {TASK_STATUS_OPTIONS.map((opt) => (
              <OptionRow
                key={opt.value}
                selected={taskStatusFilter === opt.value}
                dot={opt.dot}
                label={opt.label}
                onClick={() => setTaskStatusFilter(opt.value)}
              />
            ))}
          </div>

          {/* View section */}
          <div className="py-1.5 border-t border-white/[0.06]">
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider">View</div>
            <div className="flex gap-1 px-3 py-1">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                  taskViewMode === 'list'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300 bg-white/[0.04]'
                }`}
              >
                {ListIcon}
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                  taskViewMode === 'kanban'
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300 bg-white/[0.04]'
                }`}
              >
                {KanbanIcon}
                Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
