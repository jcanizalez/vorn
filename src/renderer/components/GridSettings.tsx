import { useAppStore } from '../stores'

const COLUMN_OPTIONS = [
  { value: 0, label: 'Auto' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' }
]

export function GridSettings() {
  const gridColumns = useAppStore((s) => s.gridColumns)
  const setGridColumns = useAppStore((s) => s.setGridColumns)

  return (
    <div className="flex items-center gap-2">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" className="text-gray-500">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
      <div className="flex bg-white/[0.04] rounded-lg p-0.5">
        {COLUMN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setGridColumns(opt.value)}
            className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
              gridColumns === opt.value
                ? 'bg-white/[0.1] text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
