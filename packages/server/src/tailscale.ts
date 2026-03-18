import { execFile } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import type { TailscaleStatus, TailscalePeer } from '@vibegrid/shared/types'
import { getSafeEnv } from './process-utils'
import log from './logger'

// ─── Binary Discovery ────────────────────────────────────────────

const TAILSCALE_PATHS = [
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale', // macOS GUI app
  '/usr/local/bin/tailscale' // Homebrew / open-source
]

let cachedBinary: string | null | undefined

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000, env: getSafeEnv() }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

export async function findTailscaleBinary(): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary

  for (const p of TAILSCALE_PATHS) {
    try {
      await access(p, constants.X_OK)
      cachedBinary = p
      return p
    } catch {
      /* try next */
    }
  }

  // Try in PATH
  try {
    const which = await exec('which', ['tailscale'])
    if (which) {
      cachedBinary = which
      return which
    }
  } catch {
    /* not in PATH */
  }

  cachedBinary = null
  return null
}

// ─── Status ──────────────────────────────────────────────────────

interface TailscaleRawStatus {
  BackendState: string
  TailscaleIPs?: string[]
  Self?: {
    HostName: string
    DNSName: string
    OS: string
    TailscaleIPs?: string[]
  }
  Peer?: Record<
    string,
    {
      HostName: string
      DNSName: string
      OS: string
      TailscaleIPs?: string[]
      Online?: boolean
    }
  >
}

export async function getTailscaleStatus(appPort?: number): Promise<TailscaleStatus> {
  const bin = await findTailscaleBinary()

  if (!bin) {
    return {
      installed: false,
      running: false,
      backendState: 'NotInstalled',
      selfIP: '',
      selfDNSName: '',
      peers: []
    }
  }

  try {
    const raw = await exec(bin, ['status', '--json'])
    const status: TailscaleRawStatus = JSON.parse(raw)

    const running = status.BackendState === 'Running'
    const selfIP = status.TailscaleIPs?.[0] ?? status.Self?.TailscaleIPs?.[0] ?? ''
    const selfDNSName = (status.Self?.DNSName ?? '').replace(/\.$/, '')

    const peers: TailscalePeer[] = Object.values(status.Peer ?? {}).map((p) => ({
      ip: p.TailscaleIPs?.[0] ?? '',
      hostname: p.HostName,
      dnsName: (p.DNSName ?? '').replace(/\.$/, ''),
      os: p.OS,
      online: !!p.Online
    }))

    return {
      installed: true,
      running,
      backendState: status.BackendState,
      selfIP,
      selfDNSName,
      selfOS: status.Self?.OS,
      peers,
      appUrl: running && appPort ? `http://${selfIP}:${appPort}/app/` : undefined
    }
  } catch (err) {
    log.warn({ err }, '[tailscale] failed to get status')
    return {
      installed: true,
      running: false,
      backendState: 'Error',
      selfIP: '',
      selfDNSName: '',
      peers: []
    }
  }
}

/** Clear the cached binary path (useful if user installs tailscale mid-session) */
export function clearBinaryCache(): void {
  cachedBinary = undefined
}
