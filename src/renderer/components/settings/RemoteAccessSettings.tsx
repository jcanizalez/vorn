import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Wifi, WifiOff, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react'

interface TailscaleStatus {
  installed: boolean
  running: boolean
  ip: string | null
  hostname: string | null
  tailnetName: string | null
  version: string | null
}

export function RemoteAccessSettings() {
  const [status, setStatus] = useState<TailscaleStatus | null>(null)
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const checkStatusRef = {
    current: async () => {
      setLoading(true)
      try {
        const result = (await window.api.rpcRequest('tailscale:status')) as TailscaleStatus
        setStatus(result)
        if (result.running && result.ip) {
          const info = (await window.api.rpcRequest('server:info')) as { port: number } | null
          if (info?.port) {
            setRemoteUrl(`http://${result.ip}:${info.port}`)
          }
        }
      } catch {
        setStatus({
          installed: false,
          running: false,
          ip: null,
          hostname: null,
          tailnetName: null,
          version: null
        })
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatusRef.current()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => {
    if (remoteUrl) {
      navigator.clipboard.writeText(remoteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-1">Remote Access</h2>
      <p className="text-sm text-gray-500 mb-6">
        Access VibeGrid from your phone or another device on your Tailscale network
      </p>

      {/* Tailscale Status */}
      <div
        className="border border-white/[0.06] rounded-lg p-4 mb-6"
        style={{ background: '#141416' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {status?.running ? (
              <Wifi size={16} className="text-green-400" />
            ) : (
              <WifiOff size={16} className="text-gray-500" />
            )}
            <h3 className="text-sm font-medium text-gray-200">Tailscale</h3>
          </div>
          <button
            onClick={() => checkStatusRef.current()}
            disabled={loading}
            className="text-xs px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08]
                       text-gray-400 hover:text-gray-200 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {!status?.installed && (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              Tailscale is not installed. Install it to enable remote access.
            </p>
            <a
              href="https://tailscale.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
            >
              Download Tailscale <ExternalLink size={12} />
            </a>
          </div>
        )}

        {status?.installed && !status.running && (
          <div>
            <p className="text-sm text-gray-400 mb-2">Tailscale is installed but not running.</p>
            <p className="text-xs text-gray-500">
              Start Tailscale and log in to your tailnet, then refresh.
            </p>
          </div>
        )}

        {status?.running && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status</span>
              <span className="text-xs text-green-400 font-medium">Connected</span>
            </div>
            {status.ip && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Tailscale IP</span>
                <span className="text-xs text-gray-300 font-mono">{status.ip}</span>
              </div>
            )}
            {status.hostname && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Hostname</span>
                <span className="text-xs text-gray-300">{status.hostname}</span>
              </div>
            )}
            {status.tailnetName && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Tailnet</span>
                <span className="text-xs text-gray-300">{status.tailnetName}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Code + URL */}
      {status?.running && status.ip && (
        <div
          className="border border-white/[0.06] rounded-lg p-4"
          style={{ background: '#141416' }}
        >
          <h3 className="text-sm font-medium text-gray-200 mb-3">Connect from another device</h3>
          <p className="text-xs text-gray-500 mb-4">
            Make sure the device is logged into the same tailnet
            {status.tailnetName ? ` (${status.tailnetName})` : ''}.
          </p>

          {remoteUrl ? (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={remoteUrl} size={160} />
              </div>
              <div className="flex items-center gap-2 w-full">
                <code
                  className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md
                             text-xs text-gray-300 font-mono overflow-x-auto whitespace-nowrap text-center"
                >
                  {remoteUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="text-xs px-2 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08]
                             text-gray-400 hover:text-gray-200 transition-colors shrink-0"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-600 text-center">
                Scan this QR code or open the URL on any device on your tailnet
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Remote access URL will appear here when the server is running with remote mode
              enabled.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
