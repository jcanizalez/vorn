import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import type { RemoteHost } from '@vibegrid/shared/types'
import { sshExecSync, shellEscape } from './process-utils'

/**
 * Run a git command locally or via SSH depending on whether a remote host is provided.
 * For remote: `cd <cwd> && git <args>`
 */
function gitExec(
  args: string[],
  cwd: string,
  opts?: { timeout?: number; remote?: RemoteHost }
): string {
  if (opts?.remote) {
    const cmd = `cd ${shellEscape(cwd, 'posix')} && git ${args.map((a) => shellEscape(a, 'posix')).join(' ')}`
    return sshExecSync(opts.remote, cmd, { timeout: opts?.timeout ?? 10000 })
  }
  return execFileSync('git', args, {
    cwd,
    ...EXEC_OPTS,
    timeout: opts?.timeout ?? 10000
  }).trim()
}

const EXEC_OPTS = {
  encoding: 'utf-8' as const,
  stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe']
}

export function getGitBranch(projectPath: string, remote?: RemoteHost): string | null {
  try {
    const branch = gitExec(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath, {
      timeout: 3000,
      remote
    }).trim()
    return branch && branch !== 'HEAD' ? branch : null
  } catch {
    return null
  }
}

export function listBranches(projectPath: string, remote?: RemoteHost): string[] {
  try {
    const output = gitExec(['branch', '--format=%(refname:short)'], projectPath, {
      timeout: 5000,
      remote
    }).trim()
    return output
      ? output
          .split('\n')
          .map((b: string) => b.trim())
          .filter(Boolean)
      : []
  } catch {
    return []
  }
}

export function listRemoteBranches(projectPath: string, remote?: RemoteHost): string[] {
  try {
    gitExec(['fetch', '--prune'], projectPath, { timeout: 15000, remote })
    const output = gitExec(['branch', '-r', '--format=%(refname:short)'], projectPath, {
      timeout: 5000,
      remote
    }).trim()
    return output
      ? output
          .split('\n')
          .map((b: string) => b.trim().replace(/^origin\//, ''))
          .filter((b: string) => b && b !== 'HEAD')
      : []
  } catch {
    return []
  }
}

export function checkoutBranch(
  projectPath: string,
  branch: string,
  remote?: RemoteHost
): { ok: boolean; error?: string } {
  try {
    gitExec(['checkout', branch], projectPath, { timeout: 10000, remote })
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

export function extractWorktreeName(worktreePath: string): string {
  const basename = path.basename(worktreePath)
  const match = basename.match(/^(.+)-[0-9a-f]{8}$/)
  return match ? match[1] : basename
}

const ADJECTIVES = [
  'lunar',
  'stellar',
  'cosmic',
  'solar',
  'astral',
  'nebular',
  'orbital',
  'galactic',
  'radiant',
  'celestial',
  'crimson',
  'golden',
  'frozen',
  'blazing',
  'silent',
  'swift',
  'phantom',
  'crystal',
  'ancient',
  'vivid',
  'amber',
  'cobalt',
  'emerald',
  'iron',
  'obsidian',
  'sapphire',
  'silver',
  'violet',
  'arctic',
  'molten'
]

const NOUNS = [
  'moon',
  'sun',
  'nova',
  'comet',
  'pulsar',
  'quasar',
  'nebula',
  'orbit',
  'titan',
  'vega',
  'mars',
  'phoenix',
  'zenith',
  'eclipse',
  'horizon',
  'vertex',
  'prism',
  'flare',
  'drift',
  'spark',
  'aurora',
  'meteor',
  'atlas',
  'helix',
  'ion',
  'nexus',
  'photon',
  'sigma',
  'omega',
  'terra'
]

function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}-${noun}`
}

export function createWorktree(
  projectPath: string,
  branch: string,
  worktreeName?: string,
  remote?: RemoteHost
): { worktreePath: string; branch: string; name: string } {
  // Use posix path separators for remote (always Linux)
  const sep = remote ? '/' : path.sep
  const projectName = remote ? projectPath.split('/').pop()! : path.basename(projectPath)
  const shortId = crypto.randomUUID().slice(0, 8)
  const rawName = worktreeName || generateName()
  const name = rawName.replace(/[^a-zA-Z0-9-]/g, '-')
  const parentDir = remote
    ? projectPath.split('/').slice(0, -1).join('/')
    : path.dirname(projectPath)
  const baseDir = `${parentDir}${sep}.vibegrid-worktrees${sep}${projectName}`
  const worktreeDir = `${baseDir}${sep}${name}-${shortId}`

  if (remote) {
    sshExecSync(remote, `mkdir -p ${shellEscape(baseDir, 'posix')}`, { timeout: 5000 })
  } else {
    fs.mkdirSync(baseDir, { recursive: true })
  }

  const localBranches = listBranches(projectPath, remote)

  if (localBranches.includes(branch)) {
    try {
      gitExec(['worktree', 'add', worktreeDir, branch], projectPath, {
        timeout: 30000,
        remote
      })
    } catch {
      const newBranch = localBranches.includes(name) ? `${name}-${shortId}` : name
      gitExec(['worktree', 'add', '-b', newBranch, worktreeDir, branch], projectPath, {
        timeout: 30000,
        remote
      })
      return { worktreePath: worktreeDir, branch: newBranch, name }
    }
  } else {
    gitExec(['worktree', 'add', '-b', branch, worktreeDir], projectPath, {
      timeout: 30000,
      remote
    })
  }

  return { worktreePath: worktreeDir, branch, name }
}

export function isWorktreeDirty(worktreePath: string, remote?: RemoteHost): boolean {
  try {
    const output = gitExec(['status', '--porcelain'], worktreePath, {
      timeout: 5000,
      remote
    }).trim()
    return output.length > 0
  } catch {
    return true
  }
}

export function renameWorktreeBranch(
  worktreePath: string,
  newBranch: string,
  remote?: RemoteHost
): boolean {
  const trimmed = newBranch.trim()
  if (!trimmed || trimmed.startsWith('-')) return false

  try {
    const currentBranch = getGitBranch(worktreePath, remote)
    if (!currentBranch) {
      gitExec(['switch', '-c', trimmed], worktreePath, { timeout: 10000, remote })
    } else {
      gitExec(['branch', '-m', trimmed], worktreePath, { timeout: 10000, remote })
    }
    return true
  } catch {
    return false
  }
}

export function renameWorktree(
  worktreePath: string,
  newName: string,
  remote?: RemoteHost
): { newPath: string; name: string } | null {
  const trimmed = newName
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  if (!trimmed) return null

  const sep = remote ? '/' : path.sep
  const dir = remote ? worktreePath.split('/').slice(0, -1).join('/') : path.dirname(worktreePath)
  const basename = remote ? worktreePath.split('/').pop()! : path.basename(worktreePath)
  const idMatch = basename.match(/-([0-9a-f]{8})$/)
  if (!idMatch) return null
  const shortId = idMatch[1]
  const newDir = `${dir}${sep}${trimmed}-${shortId}`

  if (newDir === worktreePath) return null

  if (remote) {
    const check = sshExecSync(
      remote,
      `test -d ${shellEscape(newDir, 'posix')} && echo EXISTS || echo MISSING`,
      { timeout: 5000 }
    ).trim()
    if (check === 'EXISTS') return null
  } else {
    if (fs.existsSync(newDir)) return null
  }

  try {
    gitExec(['worktree', 'move', worktreePath, newDir], worktreePath, {
      timeout: 10000,
      remote
    })
    return { newPath: newDir, name: trimmed }
  } catch {
    return null
  }
}

export function removeWorktree(
  projectPath: string,
  worktreePath: string,
  force = false,
  remote?: RemoteHost
): boolean {
  try {
    const args = ['worktree', 'remove', worktreePath]
    if (force) args.push('--force')
    gitExec(args, projectPath, { timeout: 10000, remote })
    return true
  } catch {
    return false
  }
}

export interface WorktreeEntry {
  path: string
  branch: string
  isMain: boolean
  name: string
}

export function getGitDiffStat(
  cwd: string,
  remote?: RemoteHost
): { filesChanged: number; insertions: number; deletions: number } | null {
  try {
    const output = gitExec(['diff', 'HEAD', '--numstat'], cwd, {
      timeout: 10000,
      remote
    }).trim()

    if (!output) return { filesChanged: 0, insertions: 0, deletions: 0 }

    let insertions = 0
    let deletions = 0
    let filesChanged = 0
    for (const line of output.split('\n')) {
      const parts = line.split('\t')
      if (parts[0] === '-') {
        // binary file
        filesChanged++
        continue
      }
      insertions += parseInt(parts[0], 10) || 0
      deletions += parseInt(parts[1], 10) || 0
      filesChanged++
    }
    return { filesChanged, insertions, deletions }
  } catch {
    return null
  }
}

export function getGitDiffFull(
  cwd: string,
  remote?: RemoteHost
): {
  stat: { filesChanged: number; insertions: number; deletions: number }
  files: { filePath: string; status: string; insertions: number; deletions: number; diff: string }[]
} | null {
  try {
    const stat = getGitDiffStat(cwd, remote)
    if (!stat) return null

    const MAX_DIFF_SIZE = 500 * 1024 // 500KB
    let rawDiff = gitExec(['diff', 'HEAD', '-U3'], cwd, {
      timeout: 15000,
      remote
    })

    if (rawDiff.length > MAX_DIFF_SIZE) {
      rawDiff = rawDiff.slice(0, MAX_DIFF_SIZE) + '\n\n... diff truncated (too large) ...\n'
    }

    const numstatOutput = gitExec(['diff', 'HEAD', '--numstat'], cwd, {
      timeout: 10000,
      remote
    }).trim()

    const fileStats = new Map<string, { insertions: number; deletions: number }>()
    if (numstatOutput) {
      for (const line of numstatOutput.split('\n')) {
        const parts = line.split('\t')
        if (parts.length >= 3) {
          const ins = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0
          const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0
          fileStats.set(parts.slice(2).join('\t'), { insertions: ins, deletions: del })
        }
      }
    }

    // Split raw diff by file boundaries
    const fileDiffs: {
      filePath: string
      status: string
      insertions: number
      deletions: number
      diff: string
    }[] = []
    const diffSections = rawDiff.split(/^diff --git /m).filter(Boolean)

    for (const section of diffSections) {
      const fullSection = 'diff --git ' + section
      // Extract file path from +++ line
      const plusMatch = fullSection.match(/^\+\+\+ b\/(.+)$/m)
      const minusMatch = fullSection.match(/^--- a\/(.+)$/m)
      const filePath = plusMatch?.[1] || minusMatch?.[1]?.replace(/^\/dev\/null$/, '') || 'unknown'

      // Determine status
      let status: string = 'modified'
      if (fullSection.includes('--- /dev/null')) {
        status = 'added'
      } else if (fullSection.includes('+++ /dev/null')) {
        status = 'deleted'
      } else if (fullSection.includes('rename from')) {
        status = 'renamed'
      }

      const stats = fileStats.get(filePath) || { insertions: 0, deletions: 0 }

      fileDiffs.push({
        filePath,
        status,
        insertions: stats.insertions,
        deletions: stats.deletions,
        diff: fullSection
      })
    }

    return { stat, files: fileDiffs }
  } catch {
    return null
  }
}

export function gitCommit(
  cwd: string,
  message: string,
  includeUnstaged: boolean,
  remote?: RemoteHost
): { success: boolean; error?: string } {
  try {
    if (includeUnstaged) {
      gitExec(['add', '-A'], cwd, { timeout: 10000, remote })
    }
    gitExec(['commit', '-m', message], cwd, { timeout: 15000, remote })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export function gitPush(cwd: string, remote?: RemoteHost): { success: boolean; error?: string } {
  try {
    gitExec(['push'], cwd, { timeout: 30000, remote })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export function listWorktrees(projectPath: string, remote?: RemoteHost): WorktreeEntry[] {
  try {
    const output = gitExec(['worktree', 'list', '--porcelain'], projectPath, {
      timeout: 5000,
      remote
    }).trim()

    if (!output) return []

    const worktrees: WorktreeEntry[] = []
    const blocks = output.split('\n\n')
    for (const block of blocks) {
      const lines = block.split('\n')
      const wtPath = lines.find((l: string) => l.startsWith('worktree '))?.replace('worktree ', '')
      const branchLine = lines.find((l: string) => l.startsWith('branch '))
      const branch = branchLine?.replace('branch refs/heads/', '') || 'detached'
      if (wtPath) {
        worktrees.push({
          path: wtPath,
          branch,
          isMain: worktrees.length === 0,
          name: extractWorktreeName(wtPath)
        })
      }
    }
    return worktrees
  } catch {
    return []
  }
}
