import Database from 'better-sqlite3'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import {
  AppConfig,
  ProjectConfig,
  WorkflowDefinition,
  AgentCommandConfig,
  RemoteHost,
  TaskConfig,
  TerminalSession,
  ScheduleLogEntry,
  AgentType
} from '../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'

const CONFIG_DIR = path.join(os.homedir(), '.vibegrid')
const DB_PATH = path.join(CONFIG_DIR, 'vibegrid.db')
const MAX_LOG_ENTRIES = 200

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function initDatabase(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createSchema()
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function createSchema(): void {
  const d = getDb()

  // Migrate: drop old-format workflows table (had actions/schedule columns)
  const cols = d.prepare("PRAGMA table_info(workflows)").all() as Array<{ name: string }>
  if (cols.some((c) => c.name === 'actions')) {
    d.exec('DROP TABLE workflows')
  }

  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS defaults (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      name TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      preferred_agents TEXT NOT NULL DEFAULT '[]',
      icon TEXT,
      icon_color TEXT,
      host_ids TEXT
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      icon_color TEXT NOT NULL,
      nodes TEXT NOT NULL DEFAULT '[]',
      edges TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_run_status TEXT,
      stagger_delay_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS agent_commands (
      agent_type TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      args TEXT NOT NULL DEFAULT '[]',
      fallback_command TEXT,
      fallback_args TEXT
    );

    CREATE TABLE IF NOT EXISTS remote_hosts (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      hostname TEXT NOT NULL,
      user TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      ssh_key_path TEXT,
      ssh_options TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      "order" INTEGER NOT NULL DEFAULT 0,
      assigned_session_id TEXT,
      assigned_agent TEXT,
      agent_session_id TEXT,
      branch TEXT,
      use_worktree INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent_type TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      pid INTEGER NOT NULL,
      display_name TEXT,
      branch TEXT,
      worktree_path TEXT,
      is_worktree INTEGER DEFAULT 0,
      remote_host_id TEXT,
      remote_host_label TEXT,
      hook_session_id TEXT,
      status_source TEXT,
      saved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS schedule_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      executed_at TEXT NOT NULL,
      status TEXT NOT NULL,
      sessions_launched INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_schedule_log_workflow_id ON schedule_log(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_name, status);

    CREATE TABLE IF NOT EXISTS archived_sessions (
      id TEXT PRIMARY KEY,
      agent_type TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      display_name TEXT,
      branch TEXT,
      agent_session_id TEXT,
      archived_at INTEGER NOT NULL
    );
  `)
}

// ---------------------------------------------------------------------------
// Config: load
// ---------------------------------------------------------------------------

export function loadConfig(): AppConfig {
  const d = getDb()

  const defaults = loadDefaults(d)
  const projects = loadProjects(d)
  const agentCommands = loadAgentCommands(d)
  const workflows = loadWorkflows(d)
  const remoteHosts = loadRemoteHosts(d)
  const tasks = loadTasks(d)

  return {
    version: 1,
    defaults,
    projects,
    agentCommands: Object.keys(agentCommands).length > 0 ? agentCommands : { ...DEFAULT_AGENT_COMMANDS },
    workflows,
    remoteHosts,
    tasks
  }
}

function loadDefaults(d: Database.Database): AppConfig['defaults'] {
  const rows = d.prepare('SELECT key, value FROM defaults').all() as { key: string; value: string }[]
  const map: Record<string, unknown> = {}
  for (const row of rows) {
    map[row.key] = JSON.parse(row.value)
  }

  return {
    shell: (map.shell as string) ?? (process.platform === 'win32' ? (process.env.COMSPEC || 'powershell.exe') : (process.env.SHELL || '/bin/zsh')),
    fontSize: (map.fontSize as number) ?? 13,
    theme: (map.theme as 'dark' | 'light') ?? 'dark',
    ...(map.rowHeight !== undefined && { rowHeight: map.rowHeight as number }),
    ...(map.defaultAgent !== undefined && { defaultAgent: map.defaultAgent as AgentType }),
    ...(map.notifications !== undefined && { notifications: map.notifications as AppConfig['defaults']['notifications'] }),
    ...(map.hasSeenOnboarding !== undefined && { hasSeenOnboarding: map.hasSeenOnboarding as boolean }),
    ...(map.reopenSessions !== undefined && { reopenSessions: map.reopenSessions as boolean }),
    ...(map.widgetEnabled !== undefined && { widgetEnabled: map.widgetEnabled as boolean }),
    ...(map.taskViewMode !== undefined && { taskViewMode: map.taskViewMode as AppConfig['defaults']['taskViewMode'] })
  }
}

function loadProjects(d: Database.Database): ProjectConfig[] {
  const rows = d.prepare('SELECT * FROM projects').all() as Array<{
    name: string; path: string; preferred_agents: string
    icon: string | null; icon_color: string | null; host_ids: string | null
  }>
  return rows.map((r) => ({
    name: r.name,
    path: r.path,
    preferredAgents: JSON.parse(r.preferred_agents) as AgentType[],
    ...(r.icon != null && { icon: r.icon }),
    ...(r.icon_color != null && { iconColor: r.icon_color }),
    ...(r.host_ids != null && { hostIds: JSON.parse(r.host_ids) as string[] })
  }))
}

function loadWorkflows(d: Database.Database): WorkflowDefinition[] {
  const rows = d.prepare('SELECT * FROM workflows').all() as Array<{
    id: string; name: string; icon: string; icon_color: string
    nodes: string; edges: string; enabled: number
    last_run_at: string | null; last_run_status: string | null
    stagger_delay_ms: number | null
  }>
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    iconColor: r.icon_color,
    nodes: JSON.parse(r.nodes),
    edges: JSON.parse(r.edges),
    enabled: r.enabled === 1,
    ...(r.last_run_at != null && { lastRunAt: r.last_run_at }),
    ...(r.last_run_status != null && { lastRunStatus: r.last_run_status as 'success' | 'error' }),
    ...(r.stagger_delay_ms != null && { staggerDelayMs: r.stagger_delay_ms })
  }))
}

function loadAgentCommands(d: Database.Database): Partial<Record<AgentType, AgentCommandConfig>> {
  const rows = d.prepare('SELECT * FROM agent_commands').all() as Array<{
    agent_type: string; command: string; args: string
    fallback_command: string | null; fallback_args: string | null
  }>
  const result: Partial<Record<AgentType, AgentCommandConfig>> = {}
  for (const r of rows) {
    result[r.agent_type as AgentType] = {
      command: r.command,
      args: JSON.parse(r.args),
      ...(r.fallback_command != null && { fallbackCommand: r.fallback_command }),
      ...(r.fallback_args != null && { fallbackArgs: JSON.parse(r.fallback_args) })
    }
  }
  return result
}

function loadRemoteHosts(d: Database.Database): RemoteHost[] {
  const rows = d.prepare('SELECT * FROM remote_hosts').all() as Array<{
    id: string; label: string; hostname: string; user: string; port: number
    ssh_key_path: string | null; ssh_options: string | null
  }>
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    hostname: r.hostname,
    user: r.user,
    port: r.port,
    ...(r.ssh_key_path != null && { sshKeyPath: r.ssh_key_path }),
    ...(r.ssh_options != null && { sshOptions: r.ssh_options })
  }))
}

function loadTasks(d: Database.Database): TaskConfig[] {
  const rows = d.prepare('SELECT * FROM tasks ORDER BY "order"').all() as Array<{
    id: string; project_name: string; title: string; description: string
    status: string; order: number; assigned_session_id: string | null
    assigned_agent: string | null; agent_session_id: string | null
    branch: string | null; use_worktree: number | null
    created_at: string; updated_at: string; completed_at: string | null
  }>
  return rows.map((r) => ({
    id: r.id,
    projectName: r.project_name,
    title: r.title,
    description: r.description,
    status: r.status as TaskConfig['status'],
    order: r.order,
    ...(r.assigned_session_id != null && { assignedSessionId: r.assigned_session_id }),
    ...(r.assigned_agent != null && { assignedAgent: r.assigned_agent as AgentType }),
    ...(r.agent_session_id != null && { agentSessionId: r.agent_session_id }),
    ...(r.branch != null && { branch: r.branch }),
    ...(r.use_worktree != null && r.use_worktree !== 0 && { useWorktree: true }),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.completed_at != null && { completedAt: r.completed_at })
  }))
}

// ---------------------------------------------------------------------------
// Config: save (full replace inside a transaction)
// ---------------------------------------------------------------------------

export function saveConfig(config: AppConfig): void {
  const d = getDb()

  const run = d.transaction(() => {
    // Defaults
    d.prepare('DELETE FROM defaults').run()
    const insertDefault = d.prepare('INSERT INTO defaults (key, value) VALUES (?, ?)')
    for (const [key, value] of Object.entries(config.defaults)) {
      if (value !== undefined) {
        insertDefault.run(key, JSON.stringify(value))
      }
    }

    // Projects
    d.prepare('DELETE FROM projects').run()
    const insertProject = d.prepare(
      'INSERT INTO projects (name, path, preferred_agents, icon, icon_color, host_ids) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const p of config.projects) {
      insertProject.run(
        p.name, p.path, JSON.stringify(p.preferredAgents),
        p.icon ?? null, p.iconColor ?? null,
        p.hostIds ? JSON.stringify(p.hostIds) : null
      )
    }

    // Workflows
    d.prepare('DELETE FROM workflows').run()
    const insertWorkflow = d.prepare(
      `INSERT INTO workflows (id, name, icon, icon_color, nodes, edges, enabled, last_run_at, last_run_status, stagger_delay_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const w of config.workflows ?? []) {
      insertWorkflow.run(
        w.id, w.name, w.icon, w.iconColor,
        JSON.stringify(w.nodes), JSON.stringify(w.edges),
        w.enabled ? 1 : 0,
        w.lastRunAt ?? null, w.lastRunStatus ?? null,
        w.staggerDelayMs ?? null
      )
    }

    // Agent commands
    d.prepare('DELETE FROM agent_commands').run()
    const insertAgent = d.prepare(
      'INSERT INTO agent_commands (agent_type, command, args, fallback_command, fallback_args) VALUES (?, ?, ?, ?, ?)'
    )
    if (config.agentCommands) {
      for (const [agentType, cmd] of Object.entries(config.agentCommands)) {
        if (cmd) {
          insertAgent.run(
            agentType, cmd.command, JSON.stringify(cmd.args),
            cmd.fallbackCommand ?? null,
            cmd.fallbackArgs ? JSON.stringify(cmd.fallbackArgs) : null
          )
        }
      }
    }

    // Remote hosts
    d.prepare('DELETE FROM remote_hosts').run()
    const insertHost = d.prepare(
      'INSERT INTO remote_hosts (id, label, hostname, user, port, ssh_key_path, ssh_options) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const h of config.remoteHosts ?? []) {
      insertHost.run(h.id, h.label, h.hostname, h.user, h.port, h.sshKeyPath ?? null, h.sshOptions ?? null)
    }

    // Tasks
    d.prepare('DELETE FROM tasks').run()
    const insertTask = d.prepare(
      `INSERT INTO tasks (id, project_name, title, description, status, "order", assigned_session_id, assigned_agent, agent_session_id, branch, use_worktree, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const t of config.tasks ?? []) {
      insertTask.run(
        t.id, t.projectName, t.title, t.description,
        t.status, t.order,
        t.assignedSessionId ?? null, t.assignedAgent ?? null,
        t.agentSessionId ?? null, t.branch ?? null,
        t.useWorktree ? 1 : 0,
        t.createdAt, t.updatedAt, t.completedAt ?? null
      )
    }
  })

  run()
}

// ---------------------------------------------------------------------------
// Granular updates (avoids full load/save cycle for hot paths)
// ---------------------------------------------------------------------------

export function updateWorkflowRunStatus(id: string, lastRunAt: string, lastRunStatus: string): void {
  getDb().prepare(
    'UPDATE workflows SET last_run_at = ?, last_run_status = ? WHERE id = ?'
  ).run(lastRunAt, lastRunStatus, id)
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function saveSessions(sessions: TerminalSession[]): void {
  const d = getDb()
  const savedAt = Date.now()

  const run = d.transaction(() => {
    d.prepare('DELETE FROM sessions').run()
    const insert = d.prepare(
      `INSERT INTO sessions (id, agent_type, project_name, project_path, status, created_at, pid, display_name, branch, worktree_path, is_worktree, remote_host_id, remote_host_label, hook_session_id, status_source, saved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const s of sessions) {
      insert.run(
        s.id, s.agentType, s.projectName, s.projectPath,
        s.status, s.createdAt, s.pid,
        s.displayName ?? null, s.branch ?? null,
        s.worktreePath ?? null, s.isWorktree ? 1 : 0,
        s.remoteHostId ?? null, s.remoteHostLabel ?? null,
        s.hookSessionId ?? null, s.statusSource ?? null,
        savedAt
      )
    }
  })

  run()
}

export function getPreviousSessions(): TerminalSession[] {
  const rows = getDb().prepare('SELECT * FROM sessions').all() as Array<{
    id: string; agent_type: string; project_name: string; project_path: string
    status: string; created_at: number; pid: number
    display_name: string | null; branch: string | null
    worktree_path: string | null; is_worktree: number | null
    remote_host_id: string | null; remote_host_label: string | null
    hook_session_id: string | null; status_source: string | null
    saved_at: number | null
  }>
  return rows.map((r) => ({
    id: r.id,
    agentType: r.agent_type as AgentType,
    projectName: r.project_name,
    projectPath: r.project_path,
    status: r.status as TerminalSession['status'],
    createdAt: r.created_at,
    pid: r.pid,
    ...(r.display_name != null && { displayName: r.display_name }),
    ...(r.branch != null && { branch: r.branch }),
    ...(r.worktree_path != null && { worktreePath: r.worktree_path }),
    ...(r.is_worktree != null && r.is_worktree !== 0 && { isWorktree: true }),
    ...(r.remote_host_id != null && { remoteHostId: r.remote_host_id }),
    ...(r.remote_host_label != null && { remoteHostLabel: r.remote_host_label }),
    ...(r.hook_session_id != null && { hookSessionId: r.hook_session_id }),
    ...(r.status_source != null && { statusSource: r.status_source as TerminalSession['statusSource'] })
  }))
}

export function clearSessions(): void {
  getDb().prepare('DELETE FROM sessions').run()
}

// ---------------------------------------------------------------------------
// Schedule log
// ---------------------------------------------------------------------------

export function addScheduleLogEntry(entry: ScheduleLogEntry): void {
  const d = getDb()
  d.prepare(
    `INSERT INTO schedule_log (workflow_id, workflow_name, executed_at, status, sessions_launched, error)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(entry.workflowId, entry.workflowName, entry.executedAt, entry.status, entry.sessionsLaunched, entry.error ?? null)

  // Trim to max entries
  const count = (d.prepare('SELECT COUNT(*) as c FROM schedule_log').get() as { c: number }).c
  if (count > MAX_LOG_ENTRIES) {
    d.prepare(
      `DELETE FROM schedule_log WHERE id IN (
        SELECT id FROM schedule_log ORDER BY id ASC LIMIT ?
      )`
    ).run(count - MAX_LOG_ENTRIES)
  }
}

export function getScheduleLogEntries(workflowId?: string): ScheduleLogEntry[] {
  const d = getDb()
  let rows: Array<{
    workflow_id: string; workflow_name: string; executed_at: string
    status: string; sessions_launched: number; error: string | null
  }>

  if (workflowId) {
    rows = d.prepare('SELECT * FROM schedule_log WHERE workflow_id = ? ORDER BY id').all(workflowId) as typeof rows
  } else {
    rows = d.prepare('SELECT * FROM schedule_log ORDER BY id').all() as typeof rows
  }

  return rows.map((r) => ({
    workflowId: r.workflow_id,
    workflowName: r.workflow_name,
    executedAt: r.executed_at,
    status: r.status as ScheduleLogEntry['status'],
    sessionsLaunched: r.sessions_launched,
    ...(r.error != null && { error: r.error })
  }))
}

export function clearScheduleLog(): void {
  getDb().prepare('DELETE FROM schedule_log').run()
}

// ---------------------------------------------------------------------------
// Archived sessions
// ---------------------------------------------------------------------------

export function archiveSession(session: {
  id: string; agentType: string; projectName: string; projectPath: string
  displayName?: string; branch?: string; agentSessionId?: string; archivedAt: number
}): void {
  getDb().prepare(
    `INSERT OR REPLACE INTO archived_sessions (id, agent_type, project_name, project_path, display_name, branch, agent_session_id, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    session.id, session.agentType, session.projectName, session.projectPath,
    session.displayName ?? null, session.branch ?? null,
    session.agentSessionId ?? null, session.archivedAt
  )
}

export function unarchiveSession(id: string): void {
  getDb().prepare('DELETE FROM archived_sessions WHERE id = ?').run(id)
}

export function listArchivedSessions(): Array<{
  id: string; agentType: string; projectName: string; projectPath: string
  displayName: string | null; branch: string | null; agentSessionId: string | null; archivedAt: number
}> {
  const rows = getDb().prepare('SELECT * FROM archived_sessions ORDER BY archived_at DESC').all() as Array<{
    id: string; agent_type: string; project_name: string; project_path: string
    display_name: string | null; branch: string | null; agent_session_id: string | null; archived_at: number
  }>
  return rows.map((r) => ({
    id: r.id,
    agentType: r.agent_type,
    projectName: r.project_name,
    projectPath: r.project_path,
    displayName: r.display_name,
    branch: r.branch,
    agentSessionId: r.agent_session_id,
    archivedAt: r.archived_at
  }))
}
