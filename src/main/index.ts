import { app, BrowserWindow, ipcMain, nativeImage, screen, globalShortcut } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { ptyManager } from './pty-manager'
import { configManager } from './config-manager'
import { sessionManager } from './session-persistence'
import { scheduler } from './scheduler'
import { createMenu } from './menu'
import { hookServer } from './hook-server'
import { installHooks, uninstallHooks } from './hook-installer'
import { installCopilotHooks, uninstallCopilotHooks, uninstallAllCopilotHooks, CopilotHookInstallation } from './copilot-hook-installer'
import { hookStatusMapper } from './hook-status-mapper'
import { updateManager } from './update-manager'
import { VibeGridMcpServer } from './mcp-server'
import { IPC, WidgetAgentInfo, PermissionRequestInfo } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
const mcpServer = new VibeGridMcpServer({ configManager, ptyManager, scheduler })
const copilotInstallations = new Map<string, CopilotHookInstallation>()

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
    backgroundColor: '#1a1a1e',
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
  scheduler.syncSchedules(config.workflows ?? [])

  // Check for missed schedules on startup
  const missed = scheduler.checkMissedSchedules(config.workflows ?? [])
  if (missed.length > 0) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(IPC.SCHEDULER_MISSED, missed)
    })
  }

  // Register config-change callback for main-process mutations (scheduler, hooks, etc.)
  configManager.onConfigChanged((updatedConfig) => {
    if (updatedConfig.agentCommands) {
      ptyManager.setAgentCommands(updatedConfig.agentCommands)
    }
    ptyManager.setRemoteHosts(updatedConfig.remoteHosts ?? [])
    scheduler.syncSchedules(updatedConfig.workflows ?? [])
    mainWindow?.webContents.send(IPC.CONFIG_CHANGED, updatedConfig)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Window control IPC handlers (used by custom titlebar on Windows/Linux)
  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow?.close())

  mainWindow.on('close', (e) => {
    // If widget is alive and agents are running, hide main window instead of closing
    if (widgetEnabled && ptyManager.getActiveSessions().length > 0) {
      e.preventDefault()
      mainWindow?.hide()
      showWidget()
      return
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

let widgetEnabled = true

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
      sandbox: false,
      backgroundThrottling: false
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

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })
}

function sendWidgetUpdate(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const sessions = ptyManager.getActiveSessions()
  const agents: WidgetAgentInfo[] = sessions.map(s => ({
    id: s.id,
    agentType: s.agentType,
    displayName: s.displayName,
    projectName: s.projectName,
    status: s.status
  }))
  widgetWindow.webContents.send(IPC.WIDGET_STATUS_UPDATE, agents)
}

function showWidget(): void {
  if (!widgetEnabled) return
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow()
  }
  if (widgetWindow && !widgetWindow.isVisible()) {
    sendWidgetUpdate()
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

app.whenReady().then(() => {
  configManager.init()
  registerIpcHandlers({
    onSessionCreated: (session, payload) => {
      if (payload.agentType === 'copilot') {
        const port = hookServer.getPort()
        if (port <= 0) return
        const cwd = session.worktreePath || session.projectPath
        const installation = installCopilotHooks(cwd, port)
        copilotInstallations.set(session.id, installation)
        hookStatusMapper.forceLink(installation.sessionId, session.id)
        session.hookSessionId = installation.sessionId
        session.statusSource = 'hooks'
      }
    }
  })

  // Clean up Copilot hooks.json when sessions exit
  ptyManager.on('session-exit', (session) => {
    const inst = copilotInstallations.get(session.id)
    if (inst) {
      uninstallCopilotHooks(inst)
      copilotInstallations.delete(session.id)
    }
  })

  createMenu(toggleWidget)
  createWindow()
  createWidgetWindow()
  updateManager.init(mainWindow!)

  // Load widget setting
  const config = configManager.loadConfig()
  widgetEnabled = config.defaults.widgetEnabled !== false

  // Auto show/hide widget based on main window focus
  mainWindow!.on('blur', () => {
    // Only show if a non-widget window got focus (not our own widget)
    setTimeout(() => {
      if (widgetWindow?.isFocused()) return
      showWidget()
    }, 100)
  })

  mainWindow!.on('focus', () => {
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

  // Renderer relays status changes to widget
  ipcMain.on(IPC.WIDGET_RENDERER_STATUS, () => {
    sendWidgetUpdate()
  })

  // Widget enabled/disabled setting
  ipcMain.on(IPC.WIDGET_SET_ENABLED, (_, enabled: boolean) => {
    widgetEnabled = enabled
    if (!enabled) hideWidget()
  })

  // Widget view mode resize (full / compact)
  const VIEW_SIZES = { full: { w: 280, h: 400 }, compact: { w: 140, h: 36 } }
  ipcMain.on('widget:set-view-mode', (_, mode: 'full' | 'compact') => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return
    const display = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = display.workAreaSize
    const [oldX, oldY] = widgetWindow.getPosition()
    const [oldW, oldH] = widgetWindow.getSize()
    const { w, h } = VIEW_SIZES[mode]
    // Anchor bottom-right corner
    let newX = oldX + (oldW - w)
    let newY = oldY + (oldH - h)
    // Clamp to screen bounds
    newX = Math.max(0, Math.min(newX, screenW - w))
    newY = Math.max(0, Math.min(newY, screenH - h))
    widgetWindow.setSize(w, h)
    widgetWindow.setPosition(newX, newY)
  })

  // Start hook server for agent status events
  hookServer.start().then((port) => {
    installHooks(port)

    hookServer.on('permission-cancelled', (requestId: string) => {
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send(IPC.WIDGET_PERMISSION_CANCELLED, requestId)
      }
    })

    hookServer.on('hook-event', (event) => {
      console.log(`[hooks] ${event.hook_event_name}: session=${event.session_id} cwd=${event.cwd}`)
      const result = hookStatusMapper.mapEventToStatus(event)
      if (result) {
        ptyManager.updateSessionStatus(result.terminalId, result.status)
        sendWidgetUpdate()

        // Persist agent session ID on the linked task for resume support
        if (event.hook_event_name === 'SessionStart') {
          const config = configManager.loadConfig()
          const task = config.tasks?.find(t => t.assignedSessionId === result.terminalId && t.status === 'in_progress' && !t.agentSessionId)
          if (task) {
            task.agentSessionId = event.session_id
            task.updatedAt = new Date().toISOString()
            configManager.saveConfig(config)
            console.log(`[hooks] stored agentSessionId ${event.session_id} on task "${task.title}"`)
          }
        }
      }

      const dismissEvents = ['PostToolUse', 'PostToolUseFailure', 'Stop', 'UserPromptSubmit']
      if (dismissEvents.includes(event.hook_event_name)) {
        hookServer.cancelSessionPermissions(event.session_id)
      }
    })

    hookServer.on('permission-request', ({ requestId, event }) => {
      // Try confirmed link first; fall back to cwd matching in case SessionStart was missed
      const terminalId = hookStatusMapper.getLinkedTerminal(event.session_id)
        ?? hookStatusMapper.tryLink(event.session_id, event.cwd)

      console.log(`[hooks] permission-request: session=${event.session_id} tool=${event.tool_name} cwd=${event.cwd} → terminal=${terminalId ?? 'none (passthrough)'}`)

      // Not a VibeGrid-managed session — release immediately so Claude handles it natively
      if (!terminalId) {
        hookServer.passthroughPermission(requestId)
        return
      }

      const session = ptyManager.getActiveSessions().find(s => s.id === terminalId)

      const permReq: PermissionRequestInfo = {
        requestId,
        sessionId: event.session_id,
        terminalId,
        toolName: event.tool_name || 'unknown',
        toolInput: event.tool_input || {},
        description: typeof event.tool_input?.file_path === 'string'
          ? event.tool_input.file_path as string
          : typeof event.tool_input?.command === 'string'
            ? event.tool_input.command as string
            : typeof event.tool_input?.description === 'string'
              ? event.tool_input.description as string
              : undefined,
        agentType: session?.agentType,
        projectName: session?.projectName,
        permissionSuggestions: event.permission_suggestions,
        questions: event.tool_name === 'AskUserQuestion'
          ? (event.tool_input?.questions as PermissionRequestInfo['questions'] | undefined)
          : undefined
      }

      // Send to widget
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send(IPC.WIDGET_PERMISSION_REQUEST, permReq)
      }

      // Also send to main window
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.WIDGET_PERMISSION_REQUEST, permReq)
      }

      ptyManager.updateSessionStatus(terminalId, 'waiting')
      sendWidgetUpdate()

      // Show widget only when main window is not focused (permission already sent to main renderer)
      if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) {
        showWidget()
      }

      // Register global shortcuts for quick approval
      updatePermissionShortcuts()
    })
  }).catch((err) => {
    console.error('Failed to start hook server:', err)
  })

  // Start MCP server for external tool integration (Claude Code, Cursor, etc.)
  mcpServer.start().then((port) => {
    console.log(`[mcp] server listening on http://127.0.0.1:${port}/mcp`)
  }).catch((err) => {
    console.error('Failed to start MCP server:', err)
  })

  // Permission response from widget or main window
  ipcMain.on(IPC.WIDGET_PERMISSION_RESPONSE, (_, { requestId, allow, updatedPermissions, updatedInput }: { requestId: string; allow: boolean; updatedPermissions?: unknown[]; updatedInput?: unknown }) => {
    hookServer.resolvePermission(requestId, allow, { updatedPermissions, updatedInput })
    updatePermissionShortcuts()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

function updatePermissionShortcuts(): void {
  const pending = hookServer.getPendingPermissions()

  // Unregister old shortcuts
  globalShortcut.unregister('CmdOrCtrl+Shift+A')
  globalShortcut.unregister('CmdOrCtrl+Shift+D')

  if (pending.length > 0) {
    const topRequest = pending[0]

    globalShortcut.register('CmdOrCtrl+Shift+A', () => {
      hookServer.resolvePermission(topRequest.requestId, true)
      updatePermissionShortcuts()
    })

    globalShortcut.register('CmdOrCtrl+Shift+D', () => {
      hookServer.resolvePermission(topRequest.requestId, false)
      updatePermissionShortcuts()
    })
  }
}

app.on('before-quit', () => {
  const sessions = ptyManager.getActiveSessions()
  if (sessions.length > 0) {
    sessionManager.saveSessions(sessions)
  }
  globalShortcut.unregisterAll()
  mcpServer.stop()
  hookServer.stop()
  uninstallHooks()
  uninstallAllCopilotHooks()
  hookStatusMapper.clear()
  updateManager.stop()
  scheduler.stopAll()
  ptyManager.killAll()
  configManager.close()
})

app.on('window-all-closed', () => {
  // Don't quit if widget is still showing (hidden windows don't count)
  if (process.platform !== 'darwin') {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      app.quit()
    }
  }
})
