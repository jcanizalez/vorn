/**
 * Decrypt connector credentials (via Electron safeStorage) and push the
 * plaintext into the server's in-memory store. Runs once on boot and again
 * on every CONFIG_CHANGED broadcast so new connections and edits are picked
 * up without restart.
 *
 * The DB only ever holds ciphertext; plaintext lives exclusively in the
 * server's memory, keyed by connectionId. On connection delete, the server's
 * connection:delete handler already calls clearDecryptedCreds — this module
 * is the write path only.
 */
import { safeStorage } from 'electron'
import { IPC } from '../shared/types'
import type { SourceConnection, ConnectorManifest, ConnectorConfigField } from '../shared/types'
import type { ServerBridge } from './server/server-bridge'
import log from './logger'

interface ConnectorListEntry {
  id: string
  name: string
  icon: string
  capabilities: string[]
  manifest: ConnectorManifest
}

/** Fields we treat as secrets: anything the manifest marks as `type: 'password'`. */
function secretFields(manifest: ConnectorManifest): ConnectorConfigField[] {
  return (manifest.auth ?? []).filter((f) => f.type === 'password')
}

/** Try to decrypt a stored value. Returns undefined if decryption fails
 *  (legacy plaintext entries fall through this path gracefully). */
function tryDecrypt(encryptedBase64: unknown): string | undefined {
  if (typeof encryptedBase64 !== 'string' || !encryptedBase64) return undefined
  if (!safeStorage.isEncryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'))
  } catch {
    return undefined
  }
}

async function syncOne(
  bridge: ServerBridge,
  conn: SourceConnection,
  manifest: ConnectorManifest
): Promise<void> {
  const fields = secretFields(manifest)
  if (fields.length === 0) return
  const decrypted: Record<string, string> = {}
  for (const f of fields) {
    const raw = (conn.filters as Record<string, unknown>)[f.key]
    const plain = tryDecrypt(raw)
    if (plain !== undefined) decrypted[f.key] = plain
  }
  // Always push the current view even if empty. Otherwise, when a user
  // clears a password field (or its ciphertext fails to decrypt), the
  // server's in-memory Map would retain the previous plaintext and
  // `applyDecryptedCreds()` would keep overlaying stale secrets. Clearing
  // keeps the store in sync with what's actually in the DB.
  if (Object.keys(decrypted).length === 0) {
    await bridge.request(IPC.CREDENTIALS_CLEAR_DECRYPTED, { connectionId: conn.id })
    return
  }
  await bridge.request(IPC.CREDENTIALS_SET_DECRYPTED, {
    connectionId: conn.id,
    fields: decrypted
  })
}

async function syncAll(bridge: ServerBridge): Promise<void> {
  try {
    const [connections, connectors] = await Promise.all([
      bridge.request<SourceConnection[]>(IPC.CONNECTION_LIST, { connectorId: undefined }),
      bridge.request<ConnectorListEntry[]>(IPC.CONNECTOR_LIST)
    ])
    const manifestByConnector = new Map(connectors.map((c) => [c.id, c.manifest]))
    for (const conn of connections ?? []) {
      const manifest = manifestByConnector.get(conn.connectorId)
      if (!manifest) continue
      await syncOne(bridge, conn, manifest)
    }
    log.info(
      `[connector-credentials-sync] pushed decrypted fields for ${connections?.length ?? 0} connection(s)`
    )
  } catch (err) {
    log.warn(`[connector-credentials-sync] sync failed: ${err}`)
  }
}

/**
 * Install the credential sync. Must be called after the server bridge is
 * ready (i.e. inside or after `wireServerNotifications`).
 */
export function installConnectorCredentialsSync(bridge: ServerBridge): void {
  // Initial population — do a first pass as soon as we can.
  // Delay a tick so any in-flight startup work on the server side completes.
  setTimeout(() => {
    void syncAll(bridge)
  }, 500)

  // Reactive population — re-sync on every config change. Cheap because
  // syncAll only touches the secret fields, and the server's cache does a
  // set() which is idempotent for unchanged values.
  bridge.on('server-notification', (method: string) => {
    if (method === IPC.CONFIG_CHANGED) {
      void syncAll(bridge)
    }
  })
}
