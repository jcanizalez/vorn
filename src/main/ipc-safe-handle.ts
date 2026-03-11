import { ipcMain, IpcMainInvokeEvent } from 'electron'
import log from './logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any

/**
 * Wraps an ipcMain.handle callback in a try-catch that logs errors with
 * the channel name before re-throwing. This gives us centralised error
 * visibility without changing the return-value contract that the renderer
 * already depends on.
 *
 * Usage:
 *   safeHandle(IPC.CONFIG_LOAD, () => configManager.loadConfig())
 */
export function safeHandle(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (err) {
      log.error(`[ipc] ${channel} failed:`, err)
      // Re-throw with a cleaner message so the renderer gets something useful
      // instead of "Error invoking remote method"
      throw err instanceof Error ? err : new Error(String(err))
    }
  })
}
