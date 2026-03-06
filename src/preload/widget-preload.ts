import { contextBridge, ipcRenderer } from 'electron'
import { IPC, WidgetAgentInfo, PermissionRequestInfo } from '../shared/types'

const widgetApi = {
  onStatusUpdate: (callback: (agents: WidgetAgentInfo[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, agents: WidgetAgentInfo[]): void => callback(agents)
    ipcRenderer.on(IPC.WIDGET_STATUS_UPDATE, listener)
    return () => { ipcRenderer.removeListener(IPC.WIDGET_STATUS_UPDATE, listener) }
  },

  onPermissionRequest: (callback: (request: PermissionRequestInfo) => void) => {
    const listener = (_: Electron.IpcRendererEvent, request: PermissionRequestInfo): void => callback(request)
    ipcRenderer.on(IPC.WIDGET_PERMISSION_REQUEST, listener)
    return () => { ipcRenderer.removeListener(IPC.WIDGET_PERMISSION_REQUEST, listener) }
  },

  onPermissionCancelled: (callback: (requestId: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, requestId: string): void => callback(requestId)
    ipcRenderer.on(IPC.WIDGET_PERMISSION_CANCELLED, listener)
    return () => { ipcRenderer.removeListener(IPC.WIDGET_PERMISSION_CANCELLED, listener) }
  },

  respondPermission: (requestId: string, allow: boolean, extra?: { updatedPermissions?: unknown[]; updatedInput?: unknown }) =>
    ipcRenderer.send(IPC.WIDGET_PERMISSION_RESPONSE, { requestId, allow, ...extra }),

  focusTerminal: (id: string) =>
    ipcRenderer.send(IPC.WIDGET_FOCUS_TERMINAL, id),

  hideWidget: () =>
    ipcRenderer.send(IPC.WIDGET_HIDE),

  setCompact: (compact: boolean) =>
    ipcRenderer.send('widget:set-compact', compact)
}

contextBridge.exposeInMainWorld('widgetApi', widgetApi)

export type WidgetAPI = typeof widgetApi
