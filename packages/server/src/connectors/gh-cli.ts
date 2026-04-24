import { resolveExecutable } from '../resolve-executable'

export function resolveGhPath(): string | null {
  return resolveExecutable('gh')
}

export function ghInstallHint(): string {
  switch (process.platform) {
    case 'darwin':
      return 'Install with Homebrew: `brew install gh`'
    case 'win32':
      return 'Install with winget: `winget install --id GitHub.cli` (or download from https://cli.github.com)'
    default:
      return 'Install from https://cli.github.com (Debian/Ubuntu: `sudo apt install gh`)'
  }
}

export class GhNotFoundError extends Error {
  readonly code = 'GH_NOT_FOUND'
  constructor() {
    super(`GitHub CLI (gh) not found on PATH. ${ghInstallHint()}`)
    this.name = 'GhNotFoundError'
  }
}
