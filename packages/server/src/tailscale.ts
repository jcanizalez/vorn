import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import log from './logger'

const execFileAsync = promisify(execFile)

export interface TailscaleStatus {
  installed: boolean
  running: boolean
  ip: string | null
  hostname: string | null
  tailnetName: string | null
  version: string | null
}

/**
 * Detect Tailscale installation and connection status.
 * Runs `tailscale status --json` and parses the output.
 */
export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  const notInstalled: TailscaleStatus = {
    installed: false,
    running: false,
    ip: null,
    hostname: null,
    tailnetName: null,
    version: null
  }

  try {
    const { stdout } = await execFileAsync('tailscale', ['status', '--json'], {
      timeout: 5000
    })

    const status = JSON.parse(stdout)

    // BackendState: "Running", "Stopped", "NeedsLogin", etc.
    const running = status.BackendState === 'Running'
    const self = status.Self

    if (!self) {
      return { ...notInstalled, installed: true, running: false }
    }

    // TailscaleIPs is an array like ["100.98.5.48", "fd7a:115c:a1e0::..."]
    const ip = self.TailscaleIPs?.[0] ?? null
    const hostname = self.HostName ?? null

    // Extract tailnet name from DNS suffix (e.g. "tailXXXX.ts.net" or custom)
    const dnsSuffix = status.MagicDNSSuffix ?? status.CurrentTailnet?.Name ?? null

    return {
      installed: true,
      running,
      ip,
      hostname,
      tailnetName: dnsSuffix,
      version: status.Version ?? null
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    // Command not found = not installed
    if (message.includes('ENOENT') || message.includes('not found')) {
      return notInstalled
    }

    // Other errors (e.g. daemon not running)
    log.warn(`[tailscale] status check failed: ${message}`)
    return { ...notInstalled, installed: true }
  }
}

/**
 * Check if an IP address is in the Tailscale CGNAT range (100.64.0.0/10).
 * All Tailscale IPv4 addresses fall within this range.
 */
export function isTailscaleIP(ip: string): boolean {
  // Handle IPv6-mapped IPv4 (::ffff:100.x.x.x)
  const v4 = ip.replace(/^::ffff:/, '')

  const parts = v4.split('.')
  if (parts.length !== 4) return false

  const first = parseInt(parts[0], 10)
  const second = parseInt(parts[1], 10)

  // 100.64.0.0/10 = first octet 100, second octet 64-127
  return first === 100 && second >= 64 && second <= 127
}
