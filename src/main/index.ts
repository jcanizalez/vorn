import { app, BrowserWindow, ipcMain, nativeImage, screen, globalShortcut } from 'electron'
import path from 'node:path'
import { registerIpcHandlers, setBridge } from './ipc-handlers'
import { createMenu } from './menu'
import { updateManager } from './update-manager'
import { IPC, PermissionRequestInfo } from '../shared/types'
import { launchServer, stopServer, getServerBridge } from './server/server-launcher'
import type { ServerBridge } from './server/server-bridge'
import log from './logger'

let isQuitting = false

// Ensure only one instance of the app runs at a time.
// Without this, spawning bugs (e.g. using process.execPath to launch the server)
// could cause an infinite cascade of Electron app instances.
// In dev mode, skip the lock and isolate userData so dev and production
// don't clobber each other's config/DB.
const isDev = !!process.env.ELECTRON_RENDERER_URL
if (isDev) {
  app.setPath('userData', path.join(app.getPath('userData'), '-dev'))
} else {
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  }
}

// Prevent EPIPE and other uncaught errors from crashing the main process
process.on('uncaughtException', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'EPIPE') return
  log.error('[main] uncaughtException:', err)
})

process.on('unhandledRejection', (reason) => {
  log.error('[main] unhandledRejection:', reason)
})

let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, '../../resources/icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    frame: false,
    ...(isMac
      ? {
          trafficLightPosition: { x: 16, y: 16 }
        }
      : {}),
    backgroundColor: '#1a1a1e',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  // Set dock icon on macOS (needed in dev mode since there's no app bundle)
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../../resources/icon.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // macOS: close hides window, app stays alive (quit via Cmd+Q)
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
      showWidget()
      app.dock.show().catch(() => {})
      return
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.destroy()
      widgetWindow = null
    }
  })
}

let widgetEnabled = true
let widgetReady = false

function sendToWidget(channel: string, ...args: unknown[]): void {
  if (!widgetWindow || widgetWindow.isDestroyed() || !widgetReady) return
  widgetWindow.webContents.send(channel, ...args)
}

function createWidgetWindow(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) return

  const isMac = process.platform === 'darwin'
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const widgetW = 280
  const widgetH = 400

  widgetWindow = new BrowserWindow({
    width: widgetW,
    height: widgetH,
    x: screenW - widgetW - 20,
    y: screenH - widgetH - 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    ...(isMac ? { type: 'panel' } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/widget-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isMac) {
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    widgetWindow.loadURL(process.env.ELECTRON_RENDERER_URL + '/widget.html')
  } else {
    widgetWindow.loadFile(path.join(__dirname, '../renderer/widget.html'))
  }

  widgetReady = false
  widgetWindow.webContents.once('did-finish-load', () => {
    widgetReady = true
  })
  widgetWindow.on('closed', () => {
    widgetWindow = null
    widgetReady = false
  })
}

function showWidget(): void {
  if (!widgetEnabled) return
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow()
  }
  if (widgetWindow && !widgetWindow.isVisible()) {
    widgetWindow.showInactive()
  }
}

function hideWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
    widgetWindow.hide()
  }
}

function toggleWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed() || !widgetWindow.isVisible()) {
    widgetEnabled = true
    showWidget()
  } else {
    hideWidget()
  }
}

/**
 * Wire up server notification forwarding.
 * When the server pushes events via WebSocket, forward them to the
 * renderer and widget windows.
 */
function wireServerNotifications(bridge: ServerBridge): void {
  bridge.on('server-notification', (method: string, params: unknown) => {
    switch (method) {
      // Terminal data/exit → forward to renderer
      case IPC.TERMINAL_DATA:
      case IPC.TERMINAL_EXIT:
      case IPC.HEADLESS_DATA:
      case IPC.HEADLESS_EXIT:
      case IPC.WORKTREE_CONFIRM_CLEANUP:
      case IPC.CONFIG_CHANGED:
      case IPC.SCHEDULER_EXECUTE:
      case IPC.SCHEDULER_MISSED:
      case IPC.WORKFLOW_EXECUTION_COMPLETE:
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(method, params)
        }
        break

      // Widget status updates
      case IPC.WIDGET_STATUS_UPDATE:
        sendToWidget(method, params)
        break

      // Permission requests → both widget and main window
      case IPC.WIDGET_PERMISSION_REQUEST: {
        const permReq = params as PermissionRequestInfo
        sendToWidget(method, permReq)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(method, permReq)
        }
        // Show widget only when main window is not focused
        if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) {
          showWidget()
        }
        updatePermissionShortcuts()
        break
      }

      case IPC.WIDGET_PERMISSION_CANCELLED:
        sendToWidget(method, params)
        updatePermissionShortcuts()
        break

      default:
        // Forward any other server notifications to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(method, params)
        }
        break
    }
  })
}

function updatePermissionShortcuts(): void {
  const bridge = getServerBridge()
  if (!bridge) return

  // Unregister old shortcuts
  globalShortcut.unregister('CmdOrCtrl+Shift+A')
  globalShortcut.unregister('CmdOrCtrl+Shift+D')

  // We can't query pending permissions synchronously anymore since they're on the server.
  // Instead, register shortcuts that send approval/denial for whatever is pending.
  // The server tracks what's pending.
  globalShortcut.register('CmdOrCtrl+Shift+A', () => {
    bridge.request('permission:resolve-top', { allow: true }).catch(() => {})
  })
  globalShortcut.register('CmdOrCtrl+Shift+D', () => {
    bridge.request('permission:resolve-top', { allow: false }).catch(() => {})
  })
}

// When a second instance is launched, focus the existing window instead
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(async () => {
  let bridge: ServerBridge
  try {
    bridge = await launchServer()
  } catch (err) {
    log.error('[main] Failed to launch server:', err)
    app.quit()
    return
  }

  setBridge(bridge)
  registerIpcHandlers()

  // Window control IPC handlers (Electron-only)
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow?.close())

  createMenu(toggleWidget)
  createWindow()

  if (!mainWindow) {
    log.error('[main] Failed to create main window')
    app.quit()
    return
  }

  // Wire server notifications → renderer/widget
  wireServerNotifications(bridge)

  updateManager.init(mainWindow)

  // Load widget setting via bridge
  try {
    const config = await bridge.request<{ defaults: { widgetEnabled?: boolean } }>(IPC.CONFIG_LOAD)
    widgetEnabled = config.defaults.widgetEnabled !== false
  } catch {
    // Config not available yet, use default
  }

  // Auto show/hide widget based on main window focus
  mainWindow.on('blur', () => {
    setTimeout(() => {
      if (widgetWindow?.isFocused()) return
      showWidget()
    }, 100)
  })

  mainWindow.on('focus', () => {
    hideWidget()
  })

  // Widget IPC handlers
  ipcMain.on(IPC.UPDATE_INSTALL, () => {
    updateManager.installUpdate()
  })

  ipcMain.on(IPC.WIDGET_HIDE, () => {
    hideWidget()
  })

  ipcMain.on(IPC.WIDGET_FOCUS_TERMINAL, (_, terminalId: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('widget:select-terminal', terminalId)
    }
  })

  ipcMain.on('widget:show-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  ipcMain.on(IPC.WIDGET_RENDERER_STATUS, () => {
    // Request widget update from server
    bridge.request('widget:requestUpdate').catch(() => {})
  })

  ipcMain.on(IPC.WIDGET_SET_ENABLED, (_, enabled: boolean) => {
    widgetEnabled = enabled
    if (!enabled) hideWidget()
  })

  // Widget view mode resize
  const VIEW_SIZES = { full: { w: 280, h: 400 }, compact: { w: 140, h: 36 } }
  ipcMain.on('widget:set-view-mode', (_, mode: 'full' | 'compact') => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return
    const display = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = display.workAreaSize
    const [oldX, oldY] = widgetWindow.getPosition()
    const [oldW, oldH] = widgetWindow.getSize()
    const { w, h } = VIEW_SIZES[mode]
    let newX = oldX + (oldW - w)
    let newY = oldY + (oldH - h)
    newX = Math.max(0, Math.min(newX, screenW - w))
    newY = Math.max(0, Math.min(newY, screenH - h))
    widgetWindow.setSize(w, h)
    widgetWindow.setPosition(newX, newY)
  })

  // Permission response from widget or main window → forward to server
  ipcMain.on(
    IPC.WIDGET_PERMISSION_RESPONSE,
    (
      _,
      {
        requestId,
        allow,
        updatedPermissions,
        updatedInput
      }: {
        requestId: string
        allow: boolean
        updatedPermissions?: unknown[]
        updatedInput?: unknown
      }
    ) => {
      bridge
        .request('permission:resolve', { requestId, allow, updatedPermissions, updatedInput })
        .catch((err) => log.error('[main] permission resolve failed:', err))
      updatePermissionShortcuts()
    }
  )

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    } else if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', async () => {
  isQuitting = true
  globalShortcut.unregisterAll()
  updateManager.stop()
  await stopServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
