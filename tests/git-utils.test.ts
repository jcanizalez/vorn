import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn()
}))

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true)
  }
}))

vi.mock('node:crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  }
}))

import { execFileSync } from 'node:child_process'
import {
  getGitBranch,
  listBranches,
  getGitDiffStat,
  gitCommit,
  listWorktrees
} from '../packages/server/src/git-utils'

const mockExecFileSync = vi.mocked(execFileSync)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getGitBranch', () => {
  it('returns branch name', () => {
    mockExecFileSync.mockReturnValue('main\n')
    expect(getGitBranch('/project')).toBe('main')
  })

  it('returns null for HEAD (detached)', () => {
    mockExecFileSync.mockReturnValue('HEAD\n')
    expect(getGitBranch('/project')).toBeNull()
  })

  it('returns null on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not a git repo')
    })
    expect(getGitBranch('/project')).toBeNull()
  })

  it('returns null for empty output', () => {
    mockExecFileSync.mockReturnValue('')
    expect(getGitBranch('/project')).toBeNull()
  })
})

describe('listBranches', () => {
  it('parses multi-line output', () => {
    mockExecFileSync.mockReturnValue('main\nfeature/foo\ndev\n')
    expect(listBranches('/project')).toEqual(['main', 'feature/foo', 'dev'])
  })

  it('returns empty array on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error()
    })
    expect(listBranches('/project')).toEqual([])
  })

  it('returns empty for empty output', () => {
    mockExecFileSync.mockReturnValue('')
    expect(listBranches('/project')).toEqual([])
  })

  it('trims whitespace from branch names', () => {
    mockExecFileSync.mockReturnValue('  main  \n  dev  \n')
    expect(listBranches('/project')).toEqual(['main', 'dev'])
  })
})

describe('getGitDiffStat', () => {
  it('parses numstat output', () => {
    mockExecFileSync.mockReturnValue('10\t5\tsrc/foo.ts\n3\t1\tsrc/bar.ts\n')
    expect(getGitDiffStat('/project')).toEqual({
      filesChanged: 2,
      insertions: 13,
      deletions: 6
    })
  })

  it('handles binary files', () => {
    mockExecFileSync.mockReturnValue('-\t-\timage.png\n5\t2\tsrc/foo.ts\n')
    expect(getGitDiffStat('/project')).toEqual({
      filesChanged: 2,
      insertions: 5,
      deletions: 2
    })
  })

  it('returns zeros for empty diff', () => {
    mockExecFileSync.mockReturnValue('')
    expect(getGitDiffStat('/project')).toEqual({
      filesChanged: 0,
      insertions: 0,
      deletions: 0
    })
  })

  it('returns null on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error()
    })
    expect(getGitDiffStat('/project')).toBeNull()
  })
})

describe('gitCommit', () => {
  it('calls git add -A when includeUnstaged is true', () => {
    mockExecFileSync.mockReturnValue('')
    gitCommit('/project', 'test commit', true)
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['add', '-A'],
      expect.objectContaining({ cwd: '/project' })
    )
  })

  it('does not call git add -A when includeUnstaged is false', () => {
    mockExecFileSync.mockReturnValue('')
    gitCommit('/project', 'test commit', false)
    const calls = mockExecFileSync.mock.calls
    const hasAddCall = calls.some(
      (c) => c[0] === 'git' && Array.isArray(c[1]) && (c[1] as string[]).includes('-A')
    )
    expect(hasAddCall).toBe(false)
  })

  it('passes message as argument (not interpolated into command string)', () => {
    mockExecFileSync.mockReturnValue('')
    gitCommit('/project', 'fix: "quotes" and stuff', false)
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'fix: "quotes" and stuff'],
      expect.any(Object)
    )
  })

  it('returns success on successful commit', () => {
    mockExecFileSync.mockReturnValue('')
    expect(gitCommit('/project', 'msg', false)).toEqual({ success: true })
  })

  it('returns error on failure', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('nothing to commit')
    })
    const result = gitCommit('/project', 'msg', false)
    expect(result.success).toBe(false)
    expect(result.error).toContain('nothing to commit')
  })
})

describe('listWorktrees', () => {
  it('parses porcelain output', () => {
    mockExecFileSync.mockReturnValue(
      'worktree /path/to/project\nbranch refs/heads/main\n\n' +
        'worktree /path/to/worktree\nbranch refs/heads/feature\n'
    )
    const result = listWorktrees('/path/to/project')
    expect(result).toEqual([
      { path: '/path/to/project', branch: 'main', isMain: true },
      { path: '/path/to/worktree', branch: 'feature', isMain: false }
    ])
  })

  it('handles detached HEAD', () => {
    mockExecFileSync.mockReturnValue(
      'worktree /path/to/project\nbranch refs/heads/main\n\n' +
        'worktree /path/to/worktree\ndetached\n'
    )
    const result = listWorktrees('/path/to/project')
    expect(result[1].branch).toBe('detached')
  })

  it('returns empty on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error()
    })
    expect(listWorktrees('/project')).toEqual([])
  })

  it('returns empty for empty output', () => {
    mockExecFileSync.mockReturnValue('')
    expect(listWorktrees('/project')).toEqual([])
  })
})
