import { useShallow } from 'zustand/react/shallow'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { MOD } from '../../lib/platform'

interface Props {
  terminalId: string
}

export function FocusedNavHint({ terminalId }: Props) {
  const { visibleTerminalIds, setFocusedTerminal } = useAppStore(
    useShallow((s) => ({
      visibleTerminalIds: s.visibleTerminalIds,
      setFocusedTerminal: s.setFocusedTerminal
    }))
  )

  if (visibleTerminalIds.length < 2) return null

  const index = visibleTerminalIds.indexOf(terminalId)
  if (index === -1) return null

  const total = visibleTerminalIds.length
  const prevId = visibleTerminalIds[(index - 1 + total) % total]
  const nextId = visibleTerminalIds[(index + 1) % total]

  const btn = 'p-1 rounded text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors'

  return (
    <div className="flex items-center gap-1 shrink-0 pr-1">
      <span className="text-[11px] font-mono text-gray-500 tabular-nums select-none">
        {index + 1}
        <span className="text-gray-700"> / </span>
        {total}
      </span>
      <Tooltip label="Previous session" shortcut={`${MOD}[`} position="bottom">
        <button
          type="button"
          onClick={() => setFocusedTerminal(prevId)}
          onPointerDown={(e) => e.stopPropagation()}
          className={btn}
          aria-label="Previous session"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
      </Tooltip>
      <Tooltip label="Next session" shortcut={`${MOD}]`} position="bottom">
        <button
          type="button"
          onClick={() => setFocusedTerminal(nextId)}
          onPointerDown={(e) => e.stopPropagation()}
          className={btn}
          aria-label="Next session"
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </Tooltip>
    </div>
  )
}
