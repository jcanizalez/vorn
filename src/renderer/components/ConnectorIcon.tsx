import { ExternalLink } from 'lucide-react'
import { Tooltip } from './Tooltip'

const CONNECTOR_ICONS: Record<string, React.FC<{ size: number; className?: string }>> = {
  github: ({ size, className }) => (
    <svg viewBox="0 0 16 16" width={size} height={size} className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
  linear: ({ size, className }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M3.03509 12.9431C3.24245 14.9227 4.10472 16.8468 5.62188 18.364C7.13904 19.8811 9.0631 20.7434 11.0428 20.9508L3.03509 12.9431Z" />
      <path d="M3 11.4938L12.4921 20.9858C13.2976 20.9407 14.0981 20.7879 14.8704 20.5273L3.4585 9.11548C3.19793 9.88771 3.0451 10.6883 3 11.4938Z" />
      <path d="M3.86722 8.10999L15.8758 20.1186C16.4988 19.8201 17.0946 19.4458 17.6493 18.9956L4.99021 6.33659C4.54006 6.89125 4.16573 7.487 3.86722 8.10999Z" />
      <path d="M5.66301 5.59517C9.18091 2.12137 14.8488 2.135 18.3498 5.63604C21.8508 9.13708 21.8645 14.8049 18.3907 18.3228L5.66301 5.59517Z" />
    </svg>
  )
}

const DEFAULT_ICON: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <ExternalLink size={size} className={className} />
)

export function ConnectorIcon({
  connectorId,
  size = 12,
  className = 'text-gray-500'
}: {
  connectorId: string
  size?: number
  className?: string
}) {
  const Icon = CONNECTOR_ICONS[connectorId] || DEFAULT_ICON
  return <Icon size={size} className={className} />
}

export function SourceBadge({
  connectorId,
  url,
  label
}: {
  connectorId: string
  url?: string
  label?: string
}) {
  const inner = (
    <>
      <ConnectorIcon connectorId={connectorId} size={11} className="text-gray-500" />
      {label && <span className="text-[10px] text-gray-500">{label}</span>}
      {url && (
        <ExternalLink
          size={9}
          className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      )}
    </>
  )

  if (url) {
    return (
      <Tooltip label={`Open in ${connectorId}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            window.api.openExternal(url)
          }}
          className="group inline-flex items-center gap-0.5 hover:text-gray-300 transition-colors"
        >
          {inner}
        </button>
      </Tooltip>
    )
  }

  return <span className="inline-flex items-center gap-0.5">{inner}</span>
}
