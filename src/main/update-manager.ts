import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import { IPC } from '../shared/types'
import log from './logger'

class UpdateManager {
  private mainWindow: BrowserWindow | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null

  init(mainWindow: BrowserWindow): void {
    if (!app.isPackaged) return

    this.mainWindow = mainWindow
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.mainWindow?.webContents.send(IPC.UPDATE_DOWNLOADED, {
        version: info.version
      })
    })

    autoUpdater.on('error', (err) => {
      log.error('[updater] Error:', err.message)
    })

    this.checkForUpdates()
    this.checkInterval = setInterval(() => this.checkForUpdates(), 4 * 60 * 60 * 1000)
  }

  checkForUpdates(): void {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[updater] Check failed:', err.message)
    })
  }

  installUpdate(): void {
    autoUpdater.quitAndInstall(false, true)
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}

export const updateManager = new UpdateManager()
