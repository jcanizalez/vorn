import { FolderOpen, Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../../stores'
import { Tooltip } from '../Tooltip'
import { ConfirmPopover } from '../ConfirmPopover'
import { closeTerminalSession } from '../../lib/terminal-close'
import { toast } from '../Toast'
import { getDisplayName } from '../../lib/terminal-display'
import { MOD } from '../../lib/platform'

export type CardVariant = 'mini' | 'focused'

interface Props {
  terminalId: string
  variant: CardVariant
}

export function CardActionCluster({ terminalId, variant }: Props) {
  const { terminal, setDiffSidebar, setFocused, toggleMinimized } = useAppStore(
    useShallow((s) => ({
      terminal: s.terminals.get(terminalId),
      setDiffSidebar: s.setDiffSidebarTerminalId,
      setFocused: s.setFocusedTerminal,
      toggleMinimized: s.toggleMinimized
    }))
  )

  if (!terminal) return null

  const handleBrowseFiles = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setDiffSidebar(terminalId, 'all-files')
  }

  const handleMinimize = (e: React.MouseEvent): void => {
    e.stopPropagation()
    toggleMinimized(terminalId)
  }

  const handleExpand = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setFocused(terminalId)
  }

  const handleCollapse = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setFocused(null)
  }

  const handleClose = async (): Promise<void> => {
    const name = getDisplayName(terminal.session)
    await closeTerminalSession(terminalId)
    toast.success(`Session "${name}" closed`)
  }

  const showMinimize = variant === 'mini'
  const isFocused = variant === 'focused'

  const btn = 'p-1 rounded text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors'

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Tooltip label="Browse files" position="top">
        <button
          type="button"
          onClick={handleBrowseFiles}
          onPointerDown={(e) => e.stopPropagation()}
          className={btn}
          aria-label="Browse files"
        >
          <FolderOpen size={14} strokeWidth={2} />
        </button>
      </Tooltip>

      {showMinimize && (
        <Tooltip label="Minimize" position="top">
          <button
            type="button"
            onClick={handleMinimize}
            onPointerDown={(e) => e.stopPropagation()}
            className={btn}
            aria-label="Minimize session"
          >
            <Minus size={14} strokeWidth={2} />
          </button>
        </Tooltip>
      )}

      <Tooltip
        label={isFocused ? 'Collapse to grid' : 'Expand'}
        shortcut={isFocused ? `${MOD}W` : `${MOD}O`}
        position="top"
      >
        <button
          type="button"
          onClick={isFocused ? handleCollapse : handleExpand}
          onPointerDown={(e) => e.stopPropagation()}
          className={btn}
          aria-label={isFocused ? 'Collapse session' : 'Expand session'}
        >
          {isFocused ? (
            <Minimize2 size={14} strokeWidth={2} />
          ) : (
            <Maximize2 size={14} strokeWidth={2} />
          )}
        </button>
      </Tooltip>

      <ConfirmPopover message="Close this session?" confirmLabel="Close" onConfirm={handleClose}>
        <Tooltip label="Close session" position="top">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/[0.08] transition-colors"
            aria-label="Close session"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </Tooltip>
      </ConfirmPopover>
    </div>
  )
}
