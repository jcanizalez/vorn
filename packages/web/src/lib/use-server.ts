import { useState, useEffect, useRef, useCallback } from 'react'
import { WsClient } from '../api/ws-client'
import type { AppConfig, TerminalSession, PermissionRequestInfo } from '@vibegrid/shared/types'

export interface ServerState {
  connected: boolean
  config: AppConfig | null
  sessions: TerminalSession[]
  permissionRequests: PermissionRequestInfo[]
  client: WsClient | null
  error: string | null
}

/**
 * React hook that manages a WebSocket connection to the VibeGrid server.
 *
 * On connect it loads the config and subscribes to push notifications
 * for terminal data/exit, config changes, and permission requests.
 */
export function useServer(url: string | null): ServerState {
  const [connected, setConnected] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequestInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const clientRef = useRef<WsClient | null>(null)
  const terminalDataRef = useRef(new Map<string, string[]>())

  // Expose terminal data buffer for TerminalOutput
  const getTerminalData = useCallback((id: string) => {
    return terminalDataRef.current.get(id) ?? []
  }, [])

  // Attach to window so child components can access
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__vibegridTerminalData = getTerminalData
  }, [getTerminalData])

  useEffect(() => {
    if (!url) return

    const wsUrl = url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws'
    const client = new WsClient(wsUrl)
    clientRef.current = client

    const onConnected = async () => {
      setConnected(true)
      setError(null)
      try {
        const cfg = await client.request<AppConfig>('config:load')
        setConfig(cfg)
        // Load previous sessions
        const prev = await client.request<TerminalSession[]>('sessions:getPrevious')
        setSessions(prev)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load config')
      }
    }

    const onDisconnected = () => {
      setConnected(false)
    }

    // Terminal data — buffer in ref (not state, to avoid re-render storms)
    const onTerminalData = (params: unknown) => {
      const { id, data } = params as { id: string; data: string }
      const buf = terminalDataRef.current.get(id) ?? []
      buf.push(data)
      // Cap at 5000 entries
      if (buf.length > 5000) buf.splice(0, buf.length - 5000)
      terminalDataRef.current.set(id, buf)
    }

    const onTerminalExit = (params: unknown) => {
      const { id, exitCode } = params as { id: string; exitCode: number }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: exitCode === 0 ? ('idle' as const) : ('error' as const) }
            : s
        )
      )
    }

    const onConfigChanged = (params: unknown) => {
      setConfig(params as AppConfig)
    }

    const onPermissionRequest = (params: unknown) => {
      const req = params as PermissionRequestInfo
      setPermissionRequests((prev) => [...prev, req])
    }

    const onPermissionCancelled = (params: unknown) => {
      const requestId = params as string
      setPermissionRequests((prev) => prev.filter((r) => r.requestId !== requestId))
    }

    client.subscribe('connected', onConnected)
    client.subscribe('disconnected', onDisconnected)
    client.subscribe('terminal:data', onTerminalData)
    client.subscribe('terminal:exit', onTerminalExit)
    client.subscribe('config:changed', onConfigChanged)
    client.subscribe('widget:permission-request', onPermissionRequest)
    client.subscribe('widget:permission-cancelled', onPermissionCancelled)

    client.connect()

    return () => {
      client.close()
      clientRef.current = null
      terminalDataRef.current.clear()
    }
  }, [url])

  return {
    connected,
    config,
    sessions,
    permissionRequests,
    client: clientRef.current,
    error
  }
}
