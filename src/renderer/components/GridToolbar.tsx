import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores'
import { SortMode, StatusFilter } from '../stores/types'
import { KbdHint } from './KbdHint'

/* ── Dropdown menu primitive ─────────────────────────────────── */

interface MenuOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string> {
  icon: React.ReactNode
  options: MenuOption<T>[]
  value: T
  onChange: (v: T) => void
  title: string
  label: string
}

function Dropdown<T extends string>({ icon, options, value, onChange, title, label }: DropdownProps<T>) {
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

  const activeLabel = options.find((o) => o.value === value)?.label ?? ''
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
        <span>{activeLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" className="opacity-50">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px]
                        border border-white/[0.08] rounded-lg shadow-xl overflow-hidden"
             style={{ background: 'rgba(16, 20, 32, 0.95)', backdropFilter: 'blur(16px)' }}>
          <div className="px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
            {label}
          </div>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                value === opt.value
                  ? 'text-white bg-white/[0.06]'
                  : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {value === opt.value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {value !== opt.value && <span className="w-3" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Options ─────────────────────────────────────────────────── */

const SORT_OPTIONS: MenuOption<SortMode>[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'created', label: 'Created' },
  { value: 'recent', label: 'Recent' }
]

const COLUMN_OPTIONS: MenuOption<string>[] = [
  { value: '0', label: 'Auto' },
  { value: '1', label: '1 Column' },
  { value: '2', label: '2 Columns' },
  { value: '3', label: '3 Columns' },
  { value: '4', label: '4 Columns' }
]

const STATUS_FILTERS: { value: StatusFilter; label: string; dot: string; shortcutId: string }[] = [
  { value: 'all', label: 'All', dot: 'bg-gray-400', shortcutId: 'filter-all' },
  { value: 'running', label: 'Running', dot: 'bg-green-500', shortcutId: 'filter-running' },
  { value: 'waiting', label: 'Waiting', dot: 'bg-yellow-500', shortcutId: 'filter-waiting' },
  { value: 'idle', label: 'Idle', dot: 'bg-gray-500', shortcutId: 'filter-idle' },
  { value: 'error', label: 'Error', dot: 'bg-red-500', shortcutId: 'filter-error' }
]

/* ── Icons ───────────────────────────────────────────────────── */

const SortIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M3 12h12M3 18h6" />
  </svg>
)

const GridIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
)

/* ── Component ───────────────────────────────────────────────── */

export function GridToolbar() {
  const sortMode = useAppStore((s) => s.sortMode)
  const setSortMode = useAppStore((s) => s.setSortMode)
  const statusFilter = useAppStore((s) => s.statusFilter)
  const setStatusFilter = useAppStore((s) => s.setStatusFilter)
  const gridColumns = useAppStore((s) => s.gridColumns)
  const setGridColumns = useAppStore((s) => s.setGridColumns)

  return (
    <div className="flex items-center gap-2">
      {/* Status filter — toggle pills with colored dots */}
      <div className="flex bg-white/[0.04] rounded-lg p-0.5">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md transition-colors ${
              statusFilter === opt.value
                ? 'bg-white/[0.1] text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${opt.dot} shrink-0`} />
            {opt.label}
            <KbdHint shortcutId={opt.shortcutId} />
          </button>
        ))}
      </div>

      {/* Sort — dropdown */}
      <Dropdown
        icon={SortIcon}
        options={SORT_OPTIONS}
        value={sortMode}
        onChange={setSortMode}
        title="Sort by"
        label="Sort by"
      />

      {/* Columns — dropdown */}
      <Dropdown
        icon={GridIcon}
        options={COLUMN_OPTIONS}
        value={String(gridColumns)}
        onChange={(v) => setGridColumns(Number(v))}
        title="Grid columns"
        label="Columns"
      />
    </div>
  )
}
