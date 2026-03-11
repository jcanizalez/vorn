import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

const EXEC_OPTS = {
  encoding: 'utf-8' as const,
  stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe']
}

export function getGitBranch(projectPath: string): string | null {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 3000
    }).trim()
    return branch && branch !== 'HEAD' ? branch : null
  } catch {
    return null
  }
}

export function listBranches(projectPath: string): string[] {
  try {
    const output = execFileSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 5000
    }).trim()
    return output ? output.split('\n').map((b: string) => b.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function listRemoteBranches(projectPath: string): string[] {
  try {
    execFileSync('git', ['fetch', '--prune'], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 15000
    })
    const output = execFileSync('git', ['branch', '-r', '--format=%(refname:short)'], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 5000
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

export function checkoutBranch(projectPath: string, branch: string): boolean {
  try {
    execFileSync('git', ['checkout', branch], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 10000
    })
    return true
  } catch {
    return false
  }
}

export function createWorktree(
  projectPath: string,
  branch: string
): { worktreePath: string; branch: string } {
  const projectName = path.basename(projectPath)
  const shortId = crypto.randomUUID().slice(0, 8)
  const baseDir = path.join(path.dirname(projectPath), '.vibegrid-worktrees', projectName)
  const worktreeDir = path.join(baseDir, `${branch}-${shortId}`)

  fs.mkdirSync(baseDir, { recursive: true })

  const localBranches = listBranches(projectPath)

  if (localBranches.includes(branch)) {
    // Branch exists — create worktree (git handles "already checked out" by using detached HEAD if needed)
    try {
      execFileSync('git', ['worktree', 'add', worktreeDir, branch], {
        cwd: projectPath,
        ...EXEC_OPTS,
        timeout: 30000
      })
    } catch {
      // If branch is already checked out, create a new branch from it
      const newBranch = `${branch}-worktree-${shortId}`
      execFileSync('git', ['worktree', 'add', '-b', newBranch, worktreeDir, branch], {
        cwd: projectPath,
        ...EXEC_OPTS,
        timeout: 30000
      })
      return { worktreePath: worktreeDir, branch: newBranch }
    }
  } else {
    // Branch doesn't exist locally — create new branch from HEAD
    execFileSync('git', ['worktree', 'add', '-b', branch, worktreeDir], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 30000
    })
  }

  return { worktreePath: worktreeDir, branch }
}

export function removeWorktree(projectPath: string, worktreePath: string): boolean {
  try {
    execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 10000
    })
    return true
  } catch {
    return false
  }
}

export interface WorktreeEntry {
  path: string
  branch: string
  isMain: boolean
}

export function getGitDiffStat(cwd: string): { filesChanged: number; insertions: number; deletions: number } | null {
  try {
    const output = execFileSync('git', ['diff', 'HEAD', '--numstat'], {
      cwd,
      ...EXEC_OPTS,
      timeout: 10000
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

export function getGitDiffFull(cwd: string): {
  stat: { filesChanged: number; insertions: number; deletions: number }
  files: { filePath: string; status: string; insertions: number; deletions: number; diff: string }[]
} | null {
  try {
    const stat = getGitDiffStat(cwd)
    if (!stat) return null

    const MAX_DIFF_SIZE = 500 * 1024 // 500KB
    let rawDiff = execFileSync('git', ['diff', 'HEAD', '-U3'], {
      cwd,
      ...EXEC_OPTS,
      timeout: 15000,
      maxBuffer: MAX_DIFF_SIZE * 2
    })

    if (rawDiff.length > MAX_DIFF_SIZE) {
      rawDiff = rawDiff.slice(0, MAX_DIFF_SIZE) + '\n\n... diff truncated (too large) ...\n'
    }

    // Parse numstat for per-file stats
    const numstatOutput = execFileSync('git', ['diff', 'HEAD', '--numstat'], {
      cwd,
      ...EXEC_OPTS,
      timeout: 10000
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
    const fileDiffs: { filePath: string; status: string; insertions: number; deletions: number; diff: string }[] = []
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
  includeUnstaged: boolean
): { success: boolean; error?: string } {
  try {
    if (includeUnstaged) {
      execFileSync('git', ['add', '-A'], { cwd, ...EXEC_OPTS, timeout: 10000 })
    }
    execFileSync('git', ['commit', '-m', message], {
      cwd,
      ...EXEC_OPTS,
      timeout: 15000
    })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export function gitPush(cwd: string): { success: boolean; error?: string } {
  try {
    execFileSync('git', ['push'], { cwd, ...EXEC_OPTS, timeout: 30000 })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

export function listWorktrees(projectPath: string): WorktreeEntry[] {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: projectPath,
      ...EXEC_OPTS,
      timeout: 5000
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
        worktrees.push({ path: wtPath, branch, isMain: worktrees.length === 0 })
      }
    }
    return worktrees
  } catch {
    return []
  }
}
