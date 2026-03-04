import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import yaml from 'js-yaml'
import { AppConfig } from '../shared/types'
import { DEFAULT_AGENT_COMMANDS } from '../shared/agent-defaults'

const CONFIG_DIR = path.join(os.homedir(), '.vibegrid')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.yaml')

const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  defaults: {
    shell: process.env.SHELL || '/bin/zsh',
    fontSize: 13,
    theme: 'dark'
  },
  projects: [],
  agentCommands: { ...DEFAULT_AGENT_COMMANDS },
  shortcuts: []
}

class ConfigManager {
  private watcher: fs.FSWatcher | null = null

  ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
  }

  loadConfig(): AppConfig {
    this.ensureConfigDir()

    if (!fs.existsSync(CONFIG_PATH)) {
      this.saveConfig(DEFAULT_CONFIG)
      return DEFAULT_CONFIG
    }

    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
      const parsed = yaml.load(raw) as AppConfig
      return parsed || DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  }

  saveConfig(config: AppConfig): void {
    this.ensureConfigDir()
    const raw = yaml.dump(config, { indent: 2, lineWidth: 120 })
    fs.writeFileSync(CONFIG_PATH, raw, 'utf-8')
  }

  watchConfig(callback: (config: AppConfig) => void): void {
    this.ensureConfigDir()

    // Ensure config file exists before watching
    if (!fs.existsSync(CONFIG_PATH)) {
      this.saveConfig(DEFAULT_CONFIG)
    }

    if (this.watcher) {
      this.watcher.close()
    }

    try {
      this.watcher = fs.watch(CONFIG_PATH, () => {
        try {
          const config = this.loadConfig()
          callback(config)
        } catch {
          // ignore parse errors on partial writes
        }
      })
    } catch {
      // watch may fail on some filesystems — non-critical
    }
  }

  stopWatching(): void {
    this.watcher?.close()
    this.watcher = null
  }
}

export const configManager = new ConfigManager()
