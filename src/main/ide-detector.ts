import fs from 'node:fs'
import { exec } from 'node:child_process'

export interface DetectedIDE {
  id: string
  name: string
  command: string
}

interface IDEDefinition {
  id: string
  name: string
  appPath: string | null // null = always present
  command: string
}

const IDE_DEFINITIONS: IDEDefinition[] = [
  { id: 'vscode', name: 'VS Code', appPath: '/Applications/Visual Studio Code.app', command: 'code' },
  { id: 'vscode-insiders', name: 'VS Code Insiders', appPath: '/Applications/Visual Studio Code - Insiders.app', command: 'code-insiders' },
  { id: 'cursor', name: 'Cursor', appPath: '/Applications/Cursor.app', command: 'cursor' },
  { id: 'windsurf', name: 'Windsurf', appPath: '/Applications/Windsurf.app', command: 'windsurf' },
  { id: 'zed', name: 'Zed', appPath: '/Applications/Zed.app', command: 'zed' },
  { id: 'sublime', name: 'Sublime Text', appPath: '/Applications/Sublime Text.app', command: 'subl' },
  { id: 'webstorm', name: 'WebStorm', appPath: '/Applications/WebStorm.app', command: 'webstorm' },
  { id: 'intellij', name: 'IntelliJ IDEA', appPath: '/Applications/IntelliJ IDEA.app', command: 'idea' },
  { id: 'xcode', name: 'Xcode', appPath: '/Applications/Xcode.app', command: 'xed' },
  { id: 'terminal', name: 'Terminal', appPath: null, command: 'open -a Terminal' },
  { id: 'finder', name: 'Finder', appPath: null, command: 'open' }
]

let cachedIDEs: DetectedIDE[] | null = null

export function detectIDEs(): DetectedIDE[] {
  if (cachedIDEs) return cachedIDEs

  cachedIDEs = IDE_DEFINITIONS
    .filter((def) => def.appPath === null || fs.existsSync(def.appPath))
    .map((def) => ({ id: def.id, name: def.name, command: def.command }))

  return cachedIDEs
}

export function openInIDE(ideId: string, projectPath: string): void {
  const ide = detectIDEs().find((i) => i.id === ideId)
  if (!ide) return

  const escaped = projectPath.replace(/"/g, '\\"')
  exec(`${ide.command} "${escaped}"`)
}
