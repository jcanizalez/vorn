/**
 * In-memory store for decrypted connector credentials.
 *
 * The DB stores connector secrets (API keys, tokens) encrypted via Electron's
 * safeStorage in the renderer/main layer. The server never persists plaintext.
 * At startup and on config changes, the main process decrypts the relevant
 * fields via `safeStorage.decryptString` and pushes them here through the
 * `credentials:setDecrypted` RPC. Connector call sites (scheduler, backfill,
 * actions) overlay these values on top of `connection.filters` right before
 * invoking the connector — so the plaintext only lives in this Map, never
 * on disk.
 *
 * Cleared on `credentials:clearDecrypted` (called when a connection is
 * deleted or a user signs out), and on process exit when Node tears down.
 */
import type { SourceConnection } from '@vornrun/shared/types'

const store = new Map<string, Record<string, string>>()

export function setDecryptedCreds(connectionId: string, fields: Record<string, string>): void {
  store.set(connectionId, fields)
}

export function clearDecryptedCreds(connectionId: string): void {
  store.delete(connectionId)
}

export function getDecryptedCreds(connectionId: string): Record<string, string> | undefined {
  return store.get(connectionId)
}

/** Returns a fresh filters object with decrypted credential fields overlaid. */
export function applyDecryptedCreds(conn: SourceConnection): Record<string, unknown> {
  const decrypted = store.get(conn.id)
  if (!decrypted) return { ...conn.filters }
  return { ...conn.filters, ...decrypted }
}
