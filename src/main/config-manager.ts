import { AppConfig } from '../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'
import {
  initDatabase,
  closeDatabase,
  loadConfig as dbLoadConfig,
  saveConfig as dbSaveConfig
} from './database'

type ConfigChangeCallback = (config: AppConfig) => void

class ConfigManager {
  private changeCallbacks: ConfigChangeCallback[] = []

  init(): void {
    initDatabase()
  }

  close(): void {
    closeDatabase()
  }

  loadConfig(): AppConfig {
    try {
      return dbLoadConfig()
    } catch {
      return {
        version: 1,
        defaults: {
          shell: process.platform === 'win32' ? (process.env.COMSPEC || 'powershell.exe') : (process.env.SHELL || '/bin/zsh'),
          fontSize: 13,
          theme: 'dark'
        },
        projects: [],
        agentCommands: { ...DEFAULT_AGENT_COMMANDS },
        shortcuts: [],
        tasks: []
      }
    }
  }

  saveConfig(config: AppConfig): void {
    dbSaveConfig(config)
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

  // No-ops — retained for API compatibility during transition
  watchConfig(_callback: ConfigChangeCallback): void { /* no-op with SQLite */ }
  stopWatching(): void { /* no-op with SQLite */ }
}

export const configManager = new ConfigManager()
