import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Tests for the port-file lifecycle logic used by the server (index.ts).
 *
 * The server's startup/shutdown port-file management is inline in startServer(),
 * which is expensive to spin up in tests. These tests replicate the exact same
 * read → check-PID → write / read → check-PID → delete logic against a temp
 * directory so we can verify the multi-instance safety guarantees.
 */

let tmpDir: string
let portFile: string

// --- Helpers that mirror the server's inline logic ---

function writePortFile(port: number, pid: number): boolean {
  fs.mkdirSync(path.dirname(portFile), { recursive: true })

  let shouldWrite = true
  try {
    const existing = JSON.parse(fs.readFileSync(portFile, 'utf-8'))
    if (existing.pid && existing.pid !== pid) {
      try {
        process.kill(existing.pid, 0)
        shouldWrite = false
      } catch {
        // dead PID — overwrite
      }
    }
  } catch {
    // no file or invalid JSON — overwrite
  }

  if (shouldWrite) {
    fs.writeFileSync(portFile, JSON.stringify({ port, pid }), 'utf-8')
    return true // owns the file
  }
  return false
}

function deletePortFileIfOwned(ownerPid: number): void {
  try {
    const raw = JSON.parse(fs.readFileSync(portFile, 'utf-8'))
    if (raw.pid === ownerPid) {
      fs.unlinkSync(portFile)
    }
  } catch {
    // file gone or invalid — nothing to do
  }
}

function readPortFile(): { port: number; pid: number } | null {
  try {
    return JSON.parse(fs.readFileSync(portFile, 'utf-8'))
  } catch {
    return null
  }
}

// --- Tests ---

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vorn-port-test-'))
  portFile = path.join(tmpDir, 'ws-port')
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('port file write (startup)', () => {
  it('writes port file when none exists', () => {
    const owns = writePortFile(53829, process.pid)
    expect(owns).toBe(true)

    const data = readPortFile()
    expect(data).toEqual({ port: 53829, pid: process.pid })
  })

  it('overwrites stale file from dead PID', () => {
    // Write a file claiming to be owned by a PID that does not exist
    const deadPid = 2147483647 // max PID — almost certainly not running
    fs.writeFileSync(portFile, JSON.stringify({ port: 11111, pid: deadPid }))

    const owns = writePortFile(22222, process.pid)
    expect(owns).toBe(true)

    const data = readPortFile()
    expect(data).toEqual({ port: 22222, pid: process.pid })
  })

  it('does NOT overwrite when existing PID is alive', () => {
    // Use process.ppid (our parent) as a guaranteed-alive PID that differs from
    // the "new instance" PID we'll pass to writePortFile.
    const alivePid = process.ppid
    fs.writeFileSync(portFile, JSON.stringify({ port: 11111, pid: alivePid }))

    const fakePid = 99999999
    const owns = writePortFile(22222, fakePid)
    expect(owns).toBe(false)

    // File should still have the original data
    const data = readPortFile()
    expect(data).toEqual({ port: 11111, pid: alivePid })
  })

  it('overwrites legacy plain-number format', () => {
    fs.writeFileSync(portFile, '53829')

    const owns = writePortFile(54000, process.pid)
    expect(owns).toBe(true)

    const data = readPortFile()
    expect(data).toEqual({ port: 54000, pid: process.pid })
  })

  it('allows same PID to re-write (restart scenario)', () => {
    fs.writeFileSync(portFile, JSON.stringify({ port: 11111, pid: process.pid }))

    const owns = writePortFile(22222, process.pid)
    expect(owns).toBe(true)

    const data = readPortFile()
    expect(data).toEqual({ port: 22222, pid: process.pid })
  })
})

describe('port file delete (shutdown)', () => {
  it('deletes file when PID matches', () => {
    fs.writeFileSync(portFile, JSON.stringify({ port: 53829, pid: process.pid }))

    deletePortFileIfOwned(process.pid)
    expect(fs.existsSync(portFile)).toBe(false)
  })

  it('does NOT delete when PID does not match', () => {
    const otherPid = process.ppid
    fs.writeFileSync(portFile, JSON.stringify({ port: 53829, pid: otherPid }))

    deletePortFileIfOwned(99999)
    expect(fs.existsSync(portFile)).toBe(true)

    const data = readPortFile()
    expect(data).toEqual({ port: 53829, pid: otherPid })
  })

  it('no-ops when file is already gone', () => {
    // Should not throw
    deletePortFileIfOwned(process.pid)
  })
})

describe('multi-instance scenario', () => {
  it('second instance does not clobber first, shutdown of second preserves file', () => {
    // Instance A starts (use ppid as a guaranteed-alive process)
    const alivePid = process.ppid
    fs.writeFileSync(portFile, JSON.stringify({ port: 53829, pid: alivePid }))

    // Instance B starts — should NOT overwrite because owner PID is alive
    const fakePidB = 99999999
    const ownsB = writePortFile(54000, fakePidB)
    expect(ownsB).toBe(false)

    // Instance B shuts down — should NOT delete because it doesn't own the file
    deletePortFileIfOwned(fakePidB)

    // Instance A's port file is preserved
    const data = readPortFile()
    expect(data).toEqual({ port: 53829, pid: alivePid })
  })

  it('second instance takes over after first crashes (dead PID)', () => {
    const deadPid = 2147483647
    fs.writeFileSync(portFile, JSON.stringify({ port: 53829, pid: deadPid }))

    // Instance B starts — should overwrite because old PID is dead
    const owns = writePortFile(54000, process.pid)
    expect(owns).toBe(true)

    const data = readPortFile()
    expect(data).toEqual({ port: 54000, pid: process.pid })
  })
})
