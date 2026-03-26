import type {
  CreateTerminalPayload,
  TerminalSession,
  HeadlessSession,
  AppConfig,
  ArchivedSession,
  ResizePayload,
  GitDiffStat,
  GitDiffResult,
  WorkflowExecution,
  ScriptConfig,
  ScheduleLogEntry,
  RecentSession,
  PermissionRequestInfo,
  WidgetAgentInfo,
  WorkflowDefinition,
  SSHKey,
  SSHKeyMeta
} from './types'

// ─── JSON-RPC 2.0 Envelope Types ────────────────────────────────

export interface RpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

export interface RpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: RpcError
}

export interface RpcError {
  code: number
  message: string
  data?: unknown
}

export interface RpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

// ─── Request Methods (client → server, invoke-style) ────────────

export interface RequestMethods {
  'terminal:create': { params: CreateTerminalPayload; result: TerminalSession }
  'terminal:kill': { params: string; result: void }
  'terminal:listActive': { params: void; result: TerminalSession[] }
  'terminal:rename': { params: { id: string; displayName: string }; result: void }
  'terminal:reorder': { params: string[]; result: void }
  'terminal:readOutput': { params: { id: string; lines?: number }; result: string[] }
  'shell:create': { params: string | undefined; result: TerminalSession }
  'config:load': { params: void; result: AppConfig }
  'config:save': { params: AppConfig; result: void }
  'sessions:getPrevious': { params: void; result: TerminalSession[] }
  'sessions:clear': { params: void; result: void }
  'sessions:getRecent': { params: string | undefined; result: RecentSession[] }
  'git:listBranches': {
    params: string
    result: { local: string[]; current: string | null }
  }
  'git:listRemoteBranches': { params: string; result: string[] }
  'git:createWorktree': {
    params: { projectPath: string; branch: string }
    result: string
  }
  'git:removeWorktree': {
    params: { projectPath: string; worktreePath: string; force?: boolean }
    result: void
  }
  'git:worktreeDirty': { params: string; result: boolean }
  'git:listWorktrees': {
    params: string
    result: Array<{ path: string; branch: string; isBare: boolean }>
  }
  'git:diffStat': { params: string; result: GitDiffStat }
  'git:diffFull': { params: string; result: GitDiffResult }
  'git:commit': {
    params: { cwd: string; message: string; includeUnstaged: boolean }
    result: { success: boolean; error?: string }
  }
  'git:push': { params: string; result: { success: boolean; error?: string } }
  'scheduler:getLog': {
    params: string | undefined
    result: ScheduleLogEntry[]
  }
  'scheduler:getNextRun': { params: string; result: string | null }
  'task:imageSave': {
    params: { taskId: string; sourcePath: string }
    result: string
  }
  'task:imageDelete': {
    params: { taskId: string; filename: string }
    result: void
  }
  'task:imageGetPath': {
    params: { taskId: string; filename: string }
    result: string
  }
  'task:imageCleanup': { params: string; result: void }
  'session:archive': { params: ArchivedSession; result: void }
  'session:unarchive': { params: string; result: void }
  'session:listArchived': { params: void; result: ArchivedSession[] }
  'headless:create': {
    params: CreateTerminalPayload
    result: HeadlessSession
  }
  'headless:kill': { params: string; result: void }
  'headless:list': { params: void; result: HeadlessSession[] }
  'script:execute': { params: ScriptConfig; result: { output: string; exitCode: number } }
  'workflowRun:save': { params: WorkflowExecution; result: void }
  'workflowRun:list': {
    params: { workflowId: string; limit?: number }
    result: WorkflowExecution[]
  }
  'workflowRun:listByTask': {
    params: { taskId: string; limit?: number }
    result: WorkflowExecution[]
  }
  'agent:detectInstalled': {
    params: void
    result: Record<string, boolean>
  }
  'ide:detect': { params: void; result: Array<{ id: string; name: string }> }
  'ide:open': {
    params: { ideId: string; projectPath: string }
    result: void
  }
  'permission:resolve': {
    params: {
      requestId: string
      allow: boolean
      updatedPermissions?: unknown[]
      updatedInput?: unknown
    }
    result: void
  }
  'server:shutdown': { params: void; result: void }

  // Credential vault (server-side storage)
  'credential:storeKey': {
    params: {
      label: string
      encryptedPrivateKey: string
      publicKey?: string
      certificate?: string
      keyType?: string
    }
    result: { id: string }
  }
  'credential:listKeys': { params: void; result: SSHKeyMeta[] }
  'credential:deleteKey': { params: string; result: void }
  'credential:getEncryptedKey': { params: string; result: SSHKey | null }
}

// ─── Server Notifications (server → client, push events) ────────

export interface ServerNotifications {
  'terminal:data': { id: string; data: string }
  'terminal:exit': { id: string; exitCode: number }
  'session:created': TerminalSession
  'session:updated': TerminalSession
  'session:reordered': string[]
  'headless:data': { id: string; data: string }
  'headless:exit': { id: string; exitCode: number }
  'config:changed': AppConfig
  'widget:status-update': WidgetAgentInfo[]
  'widget:permission-request': PermissionRequestInfo
  'widget:permission-cancelled': string
  'worktree:confirmCleanup': {
    terminalId: string
    worktreePath: string
    projectPath: string
    branch?: string
  }
  'scheduler:execute': {
    workflowId: string
    workflow: WorkflowDefinition
  }
  'scheduler:missed': Array<{
    workflowId: string
    workflowName: string
    missedAt: string
  }>
  'workflow:executionComplete': WorkflowExecution
  'session-exit': TerminalSession
  'database:corruption-recovered': { message: string }
}

// ─── Client Notifications (client → server, fire-and-forget) ────

export interface ClientNotifications {
  'terminal:write': { id: string; data: string }
  'terminal:resize': ResizePayload
}

// ─── Typed helpers ──────────────────────────────────────────────

export type RequestMethod = keyof RequestMethods
export type ServerNotification = keyof ServerNotifications
export type ClientNotification = keyof ClientNotifications

export function createRequest<M extends RequestMethod>(
  id: number,
  method: M,
  params: RequestMethods[M]['params']
): RpcRequest {
  return { jsonrpc: '2.0', id, method, params }
}

export function createNotification(method: string, params?: unknown): RpcNotification {
  return { jsonrpc: '2.0', method, params }
}

export function createResponse(id: number | string, result: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, result }
}

export function createErrorResponse(
  id: number | string,
  code: number,
  message: string,
  data?: unknown
): RpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } }
}
