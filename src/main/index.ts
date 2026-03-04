import { app, BrowserWindow, nativeImage } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { ptyManager } from './pty-manager'
import { configManager } from './config-manager'
import { sessionManager } from './session-persistence'
import { scheduler } from './scheduler'
import { createMenu } from './menu'
import { IPC } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../../resources/icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    frame: false,
    ...(isMac ? {
      trafficLightPosition: { x: 16, y: 16 },
      vibrancy: 'under-window',
      visualEffectState: 'active'
    } : {}),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Set dock icon on macOS (needed in dev mode since there's no app bundle)
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../../resources/icon.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  ptyManager.setMainWindow(mainWindow)
  scheduler.setMainWindow(mainWindow)

  // Load config and sync agent commands + remote hosts + schedules
  const config = configManager.loadConfig()
  if (config.agentCommands) {
    ptyManager.setAgentCommands(config.agentCommands)
  }
  ptyManager.setRemoteHosts(config.remoteHosts ?? [])
  scheduler.syncSchedules(config.shortcuts ?? [])

  // Check for missed schedules on startup
  const missed = scheduler.checkMissedSchedules(config.shortcuts ?? [])
  if (missed.length > 0) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(IPC.SCHEDULER_MISSED, missed)
    })
  }

  // Watch config for external changes
  configManager.watchConfig((updatedConfig) => {
    if (updatedConfig.agentCommands) {
      ptyManager.setAgentCommands(updatedConfig.agentCommands)
    }
    ptyManager.setRemoteHosts(updatedConfig.remoteHosts ?? [])
    scheduler.syncSchedules(updatedConfig.shortcuts ?? [])
    mainWindow?.webContents.send(IPC.CONFIG_CHANGED, updatedConfig)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  const sessions = ptyManager.getActiveSessions()
  if (sessions.length > 0) {
    sessionManager.saveSessions(sessions)
  }
  scheduler.stopAll()
  ptyManager.killAll()
  configManager.stopWatching()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
