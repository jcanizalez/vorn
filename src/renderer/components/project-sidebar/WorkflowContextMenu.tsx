import { useEffect, useRef } from 'react'
import { Pencil, Trash2, Power } from 'lucide-react'

export function WorkflowContextMenu({
  onEdit,
  onDelete,
  onToggleEnabled,
  isScheduled,
  isEnabled,
  onClose
}: {
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled?: () => void
  isScheduled?: boolean
  isEnabled?: boolean
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

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
