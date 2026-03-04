import { app, BrowserWindow, nativeImage } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { ptyManager } from './pty-manager'
import { configManager } from './config-manager'
import { sessionManager } from './session-persistence'
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
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#00000000',
    ...(isMac ? {
      vibrancy: 'under-window',
      visualEffectState: 'active'
    } : {}),
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

  // Load config and sync agent commands + remote hosts
  const config = configManager.loadConfig()
  if (config.agentCommands) {
    ptyManager.setAgentCommands(config.agentCommands)
  }
  ptyManager.setRemoteHosts(config.remoteHosts ?? [])

  // Watch config for external changes
  configManager.watchConfig((updatedConfig) => {
    if (updatedConfig.agentCommands) {
      ptyManager.setAgentCommands(updatedConfig.agentCommands)
    }
    ptyManager.setRemoteHosts(updatedConfig.remoteHosts ?? [])
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
  ptyManager.killAll()
  configManager.stopWatching()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
