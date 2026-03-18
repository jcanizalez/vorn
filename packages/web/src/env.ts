/**
 * Detect the WebSocket URL for connecting to the VibeGrid server.
 *
 * In development (Vite dev server), the proxy handles /ws → server.
 * In production (served by Fastify at /app/), connect to the same host.
 */
export function getWebSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${location.host}/ws`
}
