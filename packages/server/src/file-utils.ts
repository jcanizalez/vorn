import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FileEntry, RemoteHost } from '@vornrun/shared/types'
import { sshExecSync, shellEscape, getSafeEnv } from './process-utils'
import { resolveExecutable } from './resolve-executable'

const execFileAsync = promisify(execFile)

const gitBin = (): string => resolveExecutable('git') ?? 'git'

const ALWAYS_EXCLUDE = new Set(['.git', '.DS_Store', 'Thumbs.db'])
const MAX_READ_BYTES = 512 * 1024 // 512 KB default

// Cache gitignore sets per repo root with a 30s TTL
const ignoreCache = new Map<string, { ignored: Set<string>; timestamp: number }>()
const IGNORE_CACHE_TTL = 30_000

async function getRepoRoot(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(gitBin(), ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf-8',
      env: getSafeEnv(),
      timeout: 3000
    })
    return stdout.trim()
  } catch {
    return null
  }
}

async function getGitIgnored(cwd: string): Promise<Set<string> | null> {
  const root = await getRepoRoot(cwd)
  if (!root) return null

  const cached = ignoreCache.get(root)
  if (cached && Date.now() - cached.timestamp < IGNORE_CACHE_TTL) {
    return cached.ignored
  }

  try {
    const { stdout } = await execFileAsync(
      gitBin(),
      ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'],
      {
        cwd: root,
        encoding: 'utf-8',
        env: getSafeEnv(),
        timeout: 5000,
        maxBuffer: 1024 * 1024
      }
    )
    const lines = stdout.trim()
    const ignored = lines
      ? new Set(lines.split('\n').map((p) => path.join(root, p.replace(/\/$/, ''))))
      : new Set<string>()
    ignoreCache.set(root, { ignored, timestamp: Date.now() })
    return ignored
  } catch {
    return null
  }
}

export async function listDir(dirPath: string, remote?: RemoteHost): Promise<FileEntry[]> {
  if (remote) return listDirRemote(dirPath, remote)

  const ignored = await getGitIgnored(dirPath)
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FileEntry[] = []

  for (const entry of entries) {
    if (ALWAYS_EXCLUDE.has(entry.name)) continue
    if (entry.name.startsWith('.') && entry.name !== '.github') continue

    const fullPath = path.join(dirPath, entry.name)
    if (ignored?.has(fullPath)) continue

    result.push({
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory()
    })
  }

  result.sort(
    (a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)
  )

  return result
}

function listDirRemote(dirPath: string, remote: RemoteHost): FileEntry[] {
  try {
    // Get directory listing and git-ignored files in one SSH call
    const esc = shellEscape(dirPath, 'posix')
    const cmd = `ls -1aF ${esc} && echo '__VORN_SEP__' && (cd ${esc} && git ls-files --others --ignored --exclude-standard --directory 2>/dev/null || true)`
    const output = sshExecSync(remote, cmd, { timeout: 10000 })

    const [lsOutput, ignoredOutput] = output.split('__VORN_SEP__\n')
    if (!lsOutput?.trim()) return []

    const ignoredSet = new Set(
      (ignoredOutput || '')
        .trim()
        .split('\n')
        .map((p) => p.replace(/\/$/, ''))
        .filter(Boolean)
    )

    const result: FileEntry[] = []
    for (const line of lsOutput.trim().split('\n')) {
      const isDir = line.endsWith('/')
      const name = line.replace(/[/@*|=]$/, '')
      if (!name || name === '.' || name === '..') continue
      if (ALWAYS_EXCLUDE.has(name)) continue
      if (name.startsWith('.') && name !== '.github') continue
      if (ignoredSet.has(name)) continue

      result.push({
        name,
        path: `${dirPath}/${name}`,
        isDirectory: isDir
      })
    }

    result.sort(
      (a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name)
    )
    return result
  } catch {
    return []
  }
}

export function readFileContent(
  filePath: string,
  maxBytes: number = MAX_READ_BYTES,
  remote?: RemoteHost
): string | null {
  if (remote) return readFileContentRemote(filePath, maxBytes, remote)

  let fd: number | undefined
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return null

    fd = fs.openSync(filePath, 'r')
    const buf = Buffer.allocUnsafe(Math.min(stat.size, maxBytes))
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0)
    fs.closeSync(fd)
    fd = undefined

    const content = buf.subarray(0, bytesRead)

    // Quick binary check: look for null bytes in first 8KB
    const checkLen = Math.min(bytesRead, 8192)
    for (let i = 0; i < checkLen; i++) {
      if (content[i] === 0) return null
    }

    let text = content.toString('utf-8')
    if (bytesRead < stat.size) {
      text += `\n\n--- truncated (${stat.size} bytes total) ---`
    }
    return text
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        /* ignore close errors */
      }
    }
  }
}

function readFileContentRemote(
  filePath: string,
  maxBytes: number,
  remote: RemoteHost
): string | null {
  try {
    const text = sshExecSync(remote, `head -c ${maxBytes} ${shellEscape(filePath, 'posix')}`, {
      timeout: 10000
    })

    // Binary check
    for (let i = 0; i < Math.min(text.length, 8192); i++) {
      if (text.charCodeAt(i) === 0) return null
    }
    return text
  } catch {
    return null
  }
}
