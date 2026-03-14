import fs from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { getSafeEnv } from './process-utils'

export interface DetectedIDE {
  id: string
  name: string
  command: string
}

interface IDEDefinition {
  id: string
  name: string
  appPath: string | null // null = detect via command in PATH
  command: string
}

const MAC_IDES: IDEDefinition[] = [
  {
    id: 'vscode',
    name: 'VS Code',
    appPath: '/Applications/Visual Studio Code.app',
    command: 'code'
  },
  {
    id: 'vscode-insiders',
    name: 'VS Code Insiders',
    appPath: '/Applications/Visual Studio Code - Insiders.app',
    command: 'code-insiders'
  },
  { id: 'cursor', name: 'Cursor', appPath: '/Applications/Cursor.app', command: 'cursor' },
  { id: 'windsurf', name: 'Windsurf', appPath: '/Applications/Windsurf.app', command: 'windsurf' },
  { id: 'zed', name: 'Zed', appPath: '/Applications/Zed.app', command: 'zed' },
  {
    id: 'sublime',
    name: 'Sublime Text',
    appPath: '/Applications/Sublime Text.app',
    command: 'subl'
  },
  { id: 'webstorm', name: 'WebStorm', appPath: '/Applications/WebStorm.app', command: 'webstorm' },
  {
    id: 'intellij',
    name: 'IntelliJ IDEA',
    appPath: '/Applications/IntelliJ IDEA.app',
    command: 'idea'
  },
  { id: 'xcode', name: 'Xcode', appPath: '/Applications/Xcode.app', command: 'xed' },
  { id: 'terminal', name: 'Terminal', appPath: null, command: 'open -a Terminal' },
  { id: 'finder', name: 'Finder', appPath: null, command: 'open' }
]

const WIN_IDES: IDEDefinition[] = [
  { id: 'vscode', name: 'VS Code', appPath: null, command: 'code' },
  { id: 'vscode-insiders', name: 'VS Code Insiders', appPath: null, command: 'code-insiders' },
  { id: 'cursor', name: 'Cursor', appPath: null, command: 'cursor' },
  { id: 'windsurf', name: 'Windsurf', appPath: null, command: 'windsurf' },
  { id: 'sublime', name: 'Sublime Text', appPath: null, command: 'subl' },
  { id: 'webstorm', name: 'WebStorm', appPath: null, command: 'webstorm' },
  { id: 'intellij', name: 'IntelliJ IDEA', appPath: null, command: 'idea' },
  { id: 'explorer', name: 'Explorer', appPath: null, command: 'explorer' }
]

const LINUX_IDES: IDEDefinition[] = [
  { id: 'vscode', name: 'VS Code', appPath: null, command: 'code' },
  { id: 'vscode-insiders', name: 'VS Code Insiders', appPath: null, command: 'code-insiders' },
  { id: 'cursor', name: 'Cursor', appPath: null, command: 'cursor' },
  { id: 'windsurf', name: 'Windsurf', appPath: null, command: 'windsurf' },
  { id: 'zed', name: 'Zed', appPath: null, command: 'zed' },
  { id: 'sublime', name: 'Sublime Text', appPath: null, command: 'subl' },
  { id: 'webstorm', name: 'WebStorm', appPath: null, command: 'webstorm' },
  { id: 'intellij', name: 'IntelliJ IDEA', appPath: null, command: 'idea' },
  { id: 'file-manager', name: 'File Manager', appPath: null, command: 'xdg-open' }
]

function getIDEDefinitions(): IDEDefinition[] {
  switch (process.platform) {
    case 'win32':
      return WIN_IDES
    case 'linux':
      return LINUX_IDES
    default:
      return MAC_IDES
  }
}

function commandExists(cmd: string): boolean {
  try {
    const bin = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(bin, [cmd], { stdio: 'pipe', timeout: 3000, env: getSafeEnv() })
    return true
  } catch {
    return false
  }
}

let cachedIDEs: DetectedIDE[] | null = null

export function detectIDEs(): DetectedIDE[] {
  if (cachedIDEs) return cachedIDEs

  cachedIDEs = getIDEDefinitions()
    .filter((def) => {
      if (def.appPath) return fs.existsSync(def.appPath)
      // For entries with no appPath, check if the base command exists in PATH
      const baseCmd = def.command.split(' ')[0]
      return commandExists(baseCmd)
    })
    .map((def) => ({ id: def.id, name: def.name, command: def.command }))

  return cachedIDEs
}

export function openInIDE(ideId: string, projectPath: string): void {
  const ide = detectIDEs().find((i) => i.id === ideId)
  if (!ide) return

  const parts = ide.command.split(' ')
  const spawnOpts: import('node:child_process').SpawnOptions = {
    detached: true,
    stdio: 'ignore',
    env: getSafeEnv()
  }
  if (process.platform === 'win32') spawnOpts.shell = true
  spawn(parts[0], [...parts.slice(1), projectPath], spawnOpts).unref()
}
