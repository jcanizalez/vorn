import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args)
}))
vi.mock('node:util', () => ({
  promisify: (fn: unknown) => fn
}))

vi.mock('node:fs', () => ({
  default: {
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    openSync: vi.fn(),
    readSync: vi.fn(),
    closeSync: vi.fn()
  }
}))

import fs from 'node:fs'
import { listDir, readFileContent } from '../packages/server/src/file-utils'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listDir', () => {
  it('returns sorted entries with directories first', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'rev-parse') return { stdout: '/repo-sort\n' }
      if (args[0] === 'ls-files') return { stdout: '' }
      return { stdout: '' }
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'zebra.ts', isDirectory: () => false, isFile: () => true },
      { name: 'src', isDirectory: () => true, isFile: () => false },
      { name: 'alpha.ts', isDirectory: () => false, isFile: () => true },
      { name: 'lib', isDirectory: () => true, isFile: () => false }
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    const result = await listDir('/repo-sort')
    expect(result.map((e) => e.name)).toEqual(['lib', 'src', 'alpha.ts', 'zebra.ts'])
    expect(result[0].isDirectory).toBe(true)
    expect(result[1].isDirectory).toBe(true)
    expect(result[2].isDirectory).toBe(false)
  })

  it('excludes .git, .DS_Store, and hidden files', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'rev-parse') return { stdout: '/repo-hidden\n' }
      return { stdout: '' }
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: '.git', isDirectory: () => true, isFile: () => false },
      { name: '.DS_Store', isDirectory: () => false, isFile: () => true },
      { name: '.env', isDirectory: () => false, isFile: () => true },
      { name: '.github', isDirectory: () => true, isFile: () => false },
      { name: 'readme.md', isDirectory: () => false, isFile: () => true }
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    const result = await listDir('/repo-hidden')
    expect(result.map((e) => e.name)).toEqual(['.github', 'readme.md'])
  })

  it('excludes git-ignored entries', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'rev-parse') return { stdout: '/repo-ignore\n' }
      if (args[0] === 'ls-files') return { stdout: 'node_modules\ndist\n' }
      return { stdout: '' }
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'node_modules', isDirectory: () => true, isFile: () => false },
      { name: 'dist', isDirectory: () => true, isFile: () => false },
      { name: 'src', isDirectory: () => true, isFile: () => false }
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    const result = await listDir('/repo-ignore')
    expect(result.map((e) => e.name)).toEqual(['src'])
  })

  it('returns empty array when readdirSync throws', async () => {
    mockExecFile.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'rev-parse') return { stdout: '/repo-enoent\n' }
      return { stdout: '' }
    })

    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const result = await listDir('/repo-enoent')
    expect(result).toEqual([])
  })

  it('works when not in a git repo', async () => {
    mockExecFile.mockImplementation(() => {
      throw new Error('not a git repo')
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'file.txt', isDirectory: () => false, isFile: () => true }
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    const result = await listDir('/some/dir')
    expect(result).toEqual([{ name: 'file.txt', path: '/some/dir/file.txt', isDirectory: false }])
  })
})

describe('readFileContent', () => {
  it('returns file content as string', () => {
    const content = 'hello world'
    const buf = Buffer.from(content)

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: buf.length } as ReturnType<
      typeof fs.statSync
    >)
    vi.mocked(fs.openSync).mockReturnValue(42)
    vi.mocked(fs.readSync).mockImplementation((_fd, buffer: Buffer) => {
      buf.copy(buffer)
      return buf.length
    })

    const result = readFileContent('/test/file.txt')
    expect(result).toBe('hello world')
    expect(fs.closeSync).toHaveBeenCalledWith(42)
  })

  it('returns null for binary files (null bytes)', () => {
    const buf = Buffer.from([0x48, 0x65, 0x00, 0x6c, 0x6f]) // "He\0lo"

    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: buf.length } as ReturnType<
      typeof fs.statSync
    >)
    vi.mocked(fs.openSync).mockReturnValue(42)
    vi.mocked(fs.readSync).mockImplementation((_fd, buffer: Buffer) => {
      buf.copy(buffer)
      return buf.length
    })

    const result = readFileContent('/test/binary.bin')
    expect(result).toBeNull()
  })

  it('returns null for directories', () => {
    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => false,
      size: 0
    } as ReturnType<typeof fs.statSync>)

    const result = readFileContent('/test/dir')
    expect(result).toBeNull()
  })

  it('adds truncation notice for large files', () => {
    const content = 'x'.repeat(100)
    const buf = Buffer.from(content)

    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
      size: 1000
    } as ReturnType<typeof fs.statSync>)
    vi.mocked(fs.openSync).mockReturnValue(42)
    vi.mocked(fs.readSync).mockImplementation((_fd, buffer: Buffer) => {
      buf.copy(buffer, 0, 0, buffer.length)
      return buffer.length
    })

    const result = readFileContent('/test/big.txt', 50)
    expect(result).toContain('--- truncated (1000 bytes total) ---')
  })

  it('closes fd even when readSync throws', () => {
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true, size: 100 } as ReturnType<
      typeof fs.statSync
    >)
    vi.mocked(fs.openSync).mockReturnValue(99)
    vi.mocked(fs.readSync).mockImplementation(() => {
      throw new Error('I/O error')
    })

    const result = readFileContent('/test/bad.txt')
    expect(result).toBeNull()
    expect(fs.closeSync).toHaveBeenCalledWith(99)
  })
})
