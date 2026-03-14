import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores'
import { SortMode, StatusFilter } from '../stores/types'

/* ── Dropdown menu primitive ─────────────────────────────────── */

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

const STATUS_OPTIONS: MenuOption<StatusFilter>[] = [
  { value: 'all', label: 'All', dot: 'bg-gray-400' },
  { value: 'running', label: 'Running', dot: 'bg-green-500' },
  { value: 'waiting', label: 'Waiting', dot: 'bg-yellow-500' },
  { value: 'idle', label: 'Idle', dot: 'bg-gray-500' },
  { value: 'error', label: 'Error', dot: 'bg-red-500' }
]

/* ── Icons ───────────────────────────────────────────────────── */

const SortIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M3 12h12M3 18h6" />
  </svg>
)

const GridIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
)

const FilterIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)

const TabIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 3v6" />
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
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const layoutMode = config?.defaults?.layoutMode ?? 'grid'

  const setLayoutMode = (mode: 'grid' | 'tabs'): void => {
    if (!config || layoutMode === mode) return
    const updated = {
      ...config,
      defaults: { ...config.defaults, layoutMode: mode }
    }
    window.api.saveConfig(updated)
    setConfig(updated)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Status filter — dropdown */}
      <Dropdown
        icon={FilterIcon}
        options={STATUS_OPTIONS}
        value={statusFilter}
        onChange={setStatusFilter}
        title="Filter by status"
        label="Status"
      />

      {/* Sort — dropdown */}
      <Dropdown
        icon={SortIcon}
        options={SORT_OPTIONS}
        value={sortMode}
        onChange={setSortMode}
        title="Sort by"
        label="Sort by"
      />

      {/* Columns — dropdown (grid mode only) */}
      {layoutMode !== 'tabs' && (
        <Dropdown
          icon={GridIcon}
          options={COLUMN_OPTIONS}
          value={String(gridColumns)}
          onChange={(v) => setGridColumns(Number(v))}
          title="Grid columns"
          label="Columns"
        />
      )}

      {/* Layout toggle — pill segmented control */}
      <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5">
        <button
          onClick={() => setLayoutMode('grid')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            layoutMode === 'grid'
              ? 'bg-white/[0.1] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {GridIcon}
          <span>Grid</span>
        </button>
        <button
          onClick={() => setLayoutMode('tabs')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
            layoutMode === 'tabs'
              ? 'bg-white/[0.1] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {TabIcon}
          <span>Tabs</span>
        </button>
      </div>
    </div>
  )
}
