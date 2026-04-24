import fs from 'node:fs'
import path from 'node:path'
import { getSafeEnv } from './process-utils'

// Packaged Electron apps on macOS don't inherit the login-shell PATH, so
// user-installed binaries (Homebrew at /opt/homebrew/bin, /usr/local/bin)
// aren't visible to `spawn('name', …)`. We resolve the absolute path once
// from the user's resolved shell env and reuse it.

const cache = new Map<string, string | null>()

function find(name: string): string | null {
  const env = getSafeEnv()
  const pathEnv = env.PATH || env.Path || process.env.PATH || ''
  if (!pathEnv) return null
  const sep = process.platform === 'win32' ? ';' : ':'
  const candidates =
    process.platform === 'win32' ? [`${name}.exe`, `${name}.cmd`, name] : [name]
  for (const rawDir of pathEnv.split(sep)) {
    const dir = rawDir.trim()
    if (!dir) continue
    for (const candidate of candidates) {
      const full = path.join(dir, candidate)
      try {
        fs.accessSync(full, fs.constants.X_OK)
        return full
      } catch {
        /* not here */
      }
    }
  }
  return null
}

/**
 * Look up an executable by name on the user's PATH (login-shell PATH via
 * `getSafeEnv()`). On Windows also tries `.exe` and `.cmd` suffixes. Result
 * is cached per-name until `resetResolveCache()` is called.
 */
export function resolveExecutable(name: string): string | null {
  if (!cache.has(name)) cache.set(name, find(name))
  return cache.get(name) ?? null
}

export function resetResolveCache(name?: string): void {
  if (name) cache.delete(name)
  else cache.clear()
}
