import { useState, useEffect, useRef } from 'react'
import { Pencil, Trash2, Power, Palette } from 'lucide-react'
import { ICON_MAP } from './icon-map'
import { ICON_COLOR_PALETTE } from '../../lib/project-icons'

const WORKFLOW_ICON_OPTIONS = Object.keys(ICON_MAP)

/** Resolve a potentially lowercase icon key to the PascalCase ICON_MAP key */
function resolveIconKey(key: string): string {
  if (ICON_MAP[key]) return key
  const lower = key.toLowerCase()
  return WORKFLOW_ICON_OPTIONS.find((k) => k.toLowerCase() === lower) ?? key
}

export function WorkflowContextMenu({
  onEdit,
  onDelete,
  onToggleEnabled,
  onChangeIcon,
  isScheduled,
  isEnabled,
  currentIcon,
  currentColor,
  onClose
}: {
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled?: () => void
  onChangeIcon: (icon: string, color: string) => void
  isScheduled?: boolean
  isEnabled?: boolean
  currentIcon: string
  currentColor: string
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1
                 border border-white/[0.08] rounded-lg shadow-xl"
      style={{ background: '#141416' }}
    >
      <button
        onClick={() => {
          onEdit()
          onClose()
        }}
        className="w-full px-3 py-2.5 text-left text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.06] active:bg-white/[0.1] flex items-center gap-2 transition-colors"
      >
        <Pencil size={12} strokeWidth={1.5} />
        Edit Workflow
      </button>
      <button
        onClick={() => setShowIconPicker(!showIconPicker)}
        className="w-full px-3 py-2.5 text-left text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.06] active:bg-white/[0.1] flex items-center gap-2 transition-colors"
      >
        <Palette size={12} strokeWidth={1.5} />
        Icon & Color
      </button>
      {showIconPicker && (
        <div className="px-3 py-2 space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {WORKFLOW_ICON_OPTIONS.map((name) => {
              const IconComp = ICON_MAP[name]
              const isSelected = resolveIconKey(currentIcon) === name
              return (
                <button
                  key={name}
                  onClick={() => onChangeIcon(name, currentColor)}
                  className={`p-1.5 rounded ${
                    isSelected ? 'bg-white/[0.1] ring-1 ring-white/[0.2]' : 'hover:bg-white/[0.06]'
                  }`}
                  title={name}
                >
                  <IconComp
                    size={12}
                    color={isSelected ? currentColor : '#9ca3af'}
                    strokeWidth={1.5}
                  />
                </button>
              )
            })}
          </div>
          <div className="flex gap-1.5">
            {ICON_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => onChangeIcon(resolveIconKey(currentIcon), color)}
                className={`w-5 h-5 rounded-full border ${
                  currentColor === color
                    ? 'border-white scale-110'
                    : 'border-transparent hover:border-white/30'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
      {isScheduled && onToggleEnabled && (
        <button
          onClick={() => {
            onToggleEnabled()
            onClose()
          }}
          className="w-full px-3 py-2.5 text-left text-[13px] text-gray-300 hover:text-white
                     hover:bg-white/[0.06] active:bg-white/[0.1] flex items-center gap-2 transition-colors"
        >
          <Power size={12} strokeWidth={1.5} />
          {isEnabled ? 'Disable Schedule' : 'Enable Schedule'}
        </button>
      )}
      <button
        onClick={() => {
          onDelete()
          onClose()
        }}
        className="w-full px-3 py-2.5 text-left text-[13px] text-red-400 hover:text-red-300
                   hover:bg-white/[0.06] active:bg-white/[0.1] flex items-center gap-2 transition-colors"
      >
        <Trash2 size={12} strokeWidth={1.5} />
        Delete Workflow
      </button>
    </div>
  )
}
