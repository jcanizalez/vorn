import { useState, useEffect } from 'react'
import { useServer } from './lib/use-server'
import { ConnectPage } from './components/ConnectPage'
import { MobileLayout } from './components/MobileLayout'
import { PermissionBanner } from './components/PermissionBanner'

const STORAGE_KEY = 'vibegrid-server-url'

export function App() {
  const [serverUrl, setServerUrl] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  const { connected, config, sessions, permissionRequests, client, error } = useServer(serverUrl)

  const handleConnect = (url: string) => {
    localStorage.setItem(STORAGE_KEY, url)
    setServerUrl(url)
  }

  const handleDisconnect = () => {
    localStorage.removeItem(STORAGE_KEY)
    setServerUrl(null)
  }

  // Clear error state on disconnect
  useEffect(() => {
    if (!serverUrl) return
  }, [serverUrl])

  if (!serverUrl || !connected) {
    return (
      <ConnectPage
        onConnect={handleConnect}
        connecting={!!serverUrl && !connected && !error}
        error={error}
        savedUrl={serverUrl}
        onClearUrl={handleDisconnect}
      />
    )
  }

  return (
    <div className="min-h-screen bg-surface text-gray-300">
      {permissionRequests.length > 0 && client && (
        <PermissionBanner requests={permissionRequests} client={client} />
      )}
      <MobileLayout
        config={config}
        sessions={sessions}
        client={client}
        onDisconnect={handleDisconnect}
      />
    </div>
  )
}
