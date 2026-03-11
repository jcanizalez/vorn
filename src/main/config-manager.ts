import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { AppConfig } from '../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'
import {
  initDatabase,
  closeDatabase,
  loadConfig as dbLoadConfig,
  saveConfig as dbSaveConfig
} from './database'
import log from './logger'

type ConfigChangeCallback = (config: AppConfig) => void

const DB_DIR = path.join(os.homedir(), '.vibegrid')

class ConfigManager {
  private changeCallbacks: ConfigChangeCallback[] = []
  private dbWatcher: fs.FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  init(): void {
    initDatabase()
  }

  close(): void {
    this.stopWatchingDb()
    closeDatabase()
  }

  loadConfig(): AppConfig {
    try {
      return dbLoadConfig()
    } catch (err) {
      log.error('[config-manager] loadConfig failed, returning defaults:', err)
      return {
        version: 1,
        defaults: {
          shell: process.platform === 'win32' ? (process.env.COMSPEC || 'powershell.exe') : (process.env.SHELL || '/bin/zsh'),
          fontSize: 13,
          theme: 'dark'
        },
        projects: [],
        agentCommands: { ...DEFAULT_AGENT_COMMANDS },
        workflows: [],
        tasks: []
      }
    }
  }

  saveConfig(config: AppConfig): void {
    try {
      dbSaveConfig(config)
    } catch (err) {
      log.error('[config-manager] saveConfig failed:', err)
      throw err
    }
  }

  /** Register a callback for when config changes from within the main process */
  onConfigChanged(callback: ConfigChangeCallback): void {
    this.changeCallbacks.push(callback)
  }

  /** Notify all registered callbacks (call after main-process config mutations) */
  notifyChanged(): void {
    const config = this.loadConfig()
    for (const cb of this.changeCallbacks) {
      cb(config)
    }
  }

  /**
   * Watch the SQLite WAL file for external writes (e.g. MCP stdio process).
   * On change, debounce and notify callbacks so the GUI picks up fresh data.
   */
  watchDb(): void {
    if (this.dbWatcher) return

    // Watch the directory for WAL file changes (WAL may not exist yet)
    try {
      this.dbWatcher = fs.watch(DB_DIR, (eventType, filename) => {
        if (!filename || (!filename.endsWith('.db-wal') && !filename.endsWith('.db'))) return
        // Debounce — multiple writes can fire rapidly
        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => {
          this.notifyChanged()
        }, 200)
      })
    } catch {
      // Directory may not exist yet; ignore
    }
  }

  private stopWatchingDb(): void {
    if (this.dbWatcher) {
      this.dbWatcher.close()
      this.dbWatcher = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  // No-ops — retained for API compatibility during transition
  watchConfig(_callback: ConfigChangeCallback): void { /* no-op with SQLite */ }
  stopWatching(): void { /* no-op with SQLite */ }
}

export const configManager = new ConfigManager()
