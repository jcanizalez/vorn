import { useState } from 'react'
import { ConfirmPopover } from './ConfirmPopover'

interface Props {
  onClose: () => void
  onMinimize: () => void
  onExpand: () => void
  expanded?: boolean
}

// Always show icons on touch devices (no hover available)
const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches

export function TrafficLights({ onClose, onMinimize, onExpand, expanded }: Props) {
  const [hovered, setHovered] = useState(false)
  const showIcons = hovered || isTouchDevice

  return (
    <div
      className="flex items-center gap-[7px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Red — Close/Kill */}
      <ConfirmPopover message="Close this session?" confirmLabel="Close" onConfirm={onClose}>
        <button
          className="traffic-light-dot bg-[#ff5f57]"
          title="Close session"
          aria-label="Close session"
        >
          {showIcons && (
            <svg
              width="6"
              height="6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(80,0,0,0.8)"
              strokeWidth="4"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          )}
        </button>
      </ConfirmPopover>

      {/* Yellow — Minimize (disabled when expanded, like macOS fullscreen) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (!expanded) onMinimize()
        }}
        className={`traffic-light-dot ${expanded ? 'bg-[#3a3a3c] cursor-default' : 'bg-[#febc2e]'}`}
        style={expanded ? { pointerEvents: 'none' } : undefined}
        title={expanded ? 'Minimize disabled' : 'Minimize'}
        aria-label={expanded ? 'Minimize disabled' : 'Minimize'}
        aria-disabled={expanded}
        tabIndex={expanded ? -1 : 0}
      >
        {showIcons && !expanded && (
          <svg
            width="7"
            height="2"
            viewBox="0 0 24 4"
            fill="none"
            stroke="rgba(120,80,0,0.8)"
            strokeWidth="4"
            strokeLinecap="round"
          >
            <line x1="4" y1="2" x2="20" y2="2" />
          </svg>
        )}
      </button>

      {/* Green — Expand / Collapse */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onExpand()
        }}
        className="traffic-light-dot bg-[#28c840]"
        title={expanded ? 'Exit fullscreen' : 'Expand'}
        aria-label={expanded ? 'Exit fullscreen' : 'Expand'}
      >
        {showIcons && !expanded && (
          <svg
            width="7"
            height="7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,60,0,0.8)"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
          </svg>
        )}
        {showIcons && expanded && (
          <svg
            width="7"
            height="7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(0,60,0,0.8)"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
          </svg>
        )}
      </button>
    </div>
  )
}
