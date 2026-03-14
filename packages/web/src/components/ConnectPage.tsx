import { useState } from 'react'
import { Wifi, WifiOff, Loader2, X } from 'lucide-react'

interface ConnectPageProps {
  onConnect: (url: string) => void
  connecting: boolean
  error: string | null
  savedUrl: string | null
  onClearUrl: () => void
}

export function ConnectPage({
  onConnect,
  connecting,
  error,
  savedUrl,
  onClearUrl
}: ConnectPageProps) {
  const [url, setUrl] = useState(savedUrl ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    onConnect(trimmed)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <Wifi className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">VibeGrid</h1>
          <p className="text-sm text-gray-500 mt-1">Connect to your server</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://100.x.x.x:24842"
              disabled={connecting}
              className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.06] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50"
            />
            {savedUrl && !connecting && (
              <button
                type="button"
                onClick={() => {
                  onClearUrl()
                  setUrl('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {connecting && !error && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={connecting || !url.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        <p className="text-xs text-gray-600 text-center mt-6">
          Enter the address shown in your VibeGrid desktop app under Settings &gt; Remote Access.
        </p>
      </div>
    </div>
  )
}
