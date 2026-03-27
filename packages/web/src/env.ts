/**
 * Detect the WebSocket URL for connecting to the VibeGrid server.
 *
 * In development (Vite dev server), the proxy handles /ws → server.
 * In production (served by Fastify at /app/), connect to the same host.
 * If an auth token is available, it is appended as a query param.
 */
export function getWebSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = getAuthToken()
  const base = `${protocol}//${location.host}/ws`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

const TOKEN_STORAGE_KEY = 'vibegrid-auth-token'

/**
 * Read auth token from URL hash (#token=...) or localStorage.
 * If found in hash, persists to localStorage and strips from URL.
 */
export function getAuthToken(): string | null {
  // Check URL hash first: http://host/app/#token=vg_tk_...
  const hash = location.hash
  if (hash) {
    const match = hash.match(/[#&]token=([^&]+)/)
    if (match) {
      const token = decodeURIComponent(match[1])
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, token)
      } catch {
        // localStorage may be unavailable
      }
      // Strip token from URL to avoid leaking in shared links
      const cleanHash = hash.replace(/[#&]token=[^&]+/, '').replace(/^#$/, '')
      history.replaceState(null, '', location.pathname + location.search + cleanHash)
      return token
    }
  }

  // Fall back to localStorage
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}
