import { useAppStore } from '../stores'

export function SessionRestoredBanner() {
  const previousSessions = useAppStore((s) => s.previousSessions)
  const setSessionBanner = useAppStore((s) => s.setSessionBanner)

  const handleDismiss = (): void => {
    setSessionBanner(false)
    window.api.clearPreviousSessions()
  }

  return (
    <div className="mx-4 mt-4 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20
                    rounded-lg flex items-center justify-between">
      <div>
        <p className="text-sm text-yellow-200">
          {previousSessions.length} previous session{previousSessions.length !== 1 ? 's' : ''} ended
          when the app was last closed.
        </p>
        <p className="text-xs text-yellow-200/60 mt-0.5">
          Terminal sessions cannot be restored after app restart.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-yellow-400 hover:text-yellow-300 text-sm ml-4 shrink-0"
      >
        Dismiss
      </button>
    </div>
  )
}
