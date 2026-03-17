import { safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { safeHandle } from './ipc-safe-handle'
import { IPC, CreateTerminalPayload, AppConfig, SSHKey } from '../shared/types'
import type { ServerBridge } from './server/server-bridge'
import log from './logger'

function detectKeyType(content: string): string | undefined {
  if (content.includes('ED25519')) return 'ed25519'
  if (content.includes('RSA')) return 'rsa'
  if (content.includes('ECDSA')) return 'ecdsa'
  if (content.includes('DSA')) return 'dsa'
  return undefined
}

export function registerCredentialHandlers(bridge: ServerBridge): void {
  safeHandle(IPC.CREDENTIAL_SAFE_STORAGE_AVAILABLE, () => {
    return safeStorage.isEncryptionAvailable()
  })

  safeHandle(IPC.CREDENTIAL_ENCRYPT, (_, plaintext: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS keychain encryption not available')
    }
    return safeStorage.encryptString(plaintext).toString('base64')
  })

  safeHandle(
    IPC.CREDENTIAL_STORE_KEY,
    async (
      _,
      params: {
        label: string
        privateKey: string
        publicKey?: string
        certificate?: string
      }
    ) => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS keychain encryption not available')
      }
      const encrypted = safeStorage.encryptString(params.privateKey).toString('base64')

      const keyType = detectKeyType(params.privateKey)

      return bridge.request(IPC.CREDENTIAL_STORE_KEY, {
        label: params.label,
        encryptedPrivateKey: encrypted,
        publicKey: params.publicKey,
        certificate: params.certificate,
        keyType
      })
    }
  )

  safeHandle(
    IPC.CREDENTIAL_IMPORT_KEY_FILE,
    async (_, params: { filePath: string; label?: string }) => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('OS keychain encryption not available')
      }
      const content = fs.readFileSync(params.filePath, 'utf-8')
      const encrypted = safeStorage.encryptString(content).toString('base64')

      const keyType = detectKeyType(content)

      // Try to read .pub sidecar file
      let publicKey: string | undefined
      const pubPath = params.filePath + '.pub'
      if (fs.existsSync(pubPath)) {
        publicKey = fs.readFileSync(pubPath, 'utf-8').trim()
      }

      const label = params.label || path.basename(params.filePath)

      return bridge.request(IPC.CREDENTIAL_STORE_KEY, {
        label,
        encryptedPrivateKey: encrypted,
        publicKey,
        keyType
      })
    }
  )

  safeHandle(IPC.CREDENTIAL_LIST_KEYS, () => {
    return bridge.request(IPC.CREDENTIAL_LIST_KEYS)
  })

  safeHandle(IPC.CREDENTIAL_DELETE_KEY, (_, id: string) => {
    return bridge.request(IPC.CREDENTIAL_DELETE_KEY, id)
  })
}

/**
 * Enrich a terminal:create payload with decrypted credentials when needed.
 * Called in the main process before forwarding to the server.
 */
export async function enrichPayloadWithCredentials(
  payload: CreateTerminalPayload,
  bridge: ServerBridge
): Promise<CreateTerminalPayload> {
  if (!payload.remoteHostId) return payload

  try {
    const config = await bridge.request<AppConfig>(IPC.CONFIG_LOAD)
    const host = config.remoteHosts?.find((h) => h.id === payload.remoteHostId)
    if (!host) return payload

    if (host.authMethod === 'key-stored' && host.credentialId) {
      const key = await bridge.request<SSHKey | null>(
        IPC.CREDENTIAL_GET_ENCRYPTED_KEY,
        host.credentialId
      )
      if (key && safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(Buffer.from(key.encryptedPrivateKey, 'base64'))
        return { ...payload, _decryptedKeyContent: decrypted }
      }
    }

    if (host.authMethod === 'password' && host.encryptedPassword) {
      if (safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(Buffer.from(host.encryptedPassword, 'base64'))
        return { ...payload, _decryptedPassword: decrypted }
      }
    }
  } catch (err) {
    log.error('[credentials] failed to enrich payload:', err)
  }

  return payload
}
