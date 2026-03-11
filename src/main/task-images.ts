import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'

const IMAGES_DIR = path.join(app.getPath('userData'), 'task-images')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/** Validate that an identifier contains only safe characters (alphanumeric, hyphens, underscores) */
function isSafeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

/** Validate that a filename contains only safe characters (alphanumeric, hyphens, underscores, dots) and no path separators */
function isSafeFilename(value: string): boolean {
  return /^[a-zA-Z0-9_.-]+$/.test(value) && !value.startsWith('.')
}

/** Resolve a path and verify it stays within the images directory */
function resolveSafePath(...segments: string[]): string {
  const resolved = path.resolve(IMAGES_DIR, ...segments)
  if (!resolved.startsWith(IMAGES_DIR + path.sep) && resolved !== IMAGES_DIR) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

export function saveTaskImage(taskId: string, sourcePath: string): string {
  if (!isSafeId(taskId)) throw new Error(`Invalid taskId: ${taskId}`)

  const taskDir = resolveSafePath(taskId)
  ensureDir(taskDir)

  const ext = path.extname(sourcePath)
  const filename = `${randomUUID()}${ext}`
  const destPath = resolveSafePath(taskId, filename)

  fs.copyFileSync(sourcePath, destPath)
  return filename
}

export function deleteTaskImage(taskId: string, filename: string): void {
  if (!isSafeId(taskId)) throw new Error(`Invalid taskId: ${taskId}`)
  if (!isSafeFilename(filename)) throw new Error(`Invalid filename: ${filename}`)

  const filePath = resolveSafePath(taskId, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function getTaskImagePath(taskId: string, filename: string): string {
  if (!isSafeId(taskId)) throw new Error(`Invalid taskId: ${taskId}`)
  if (!isSafeFilename(filename)) throw new Error(`Invalid filename: ${filename}`)

  return resolveSafePath(taskId, filename)
}

export function cleanupTaskImages(taskId: string): void {
  if (!isSafeId(taskId)) throw new Error(`Invalid taskId: ${taskId}`)

  const taskDir = resolveSafePath(taskId)
  if (fs.existsSync(taskDir)) {
    fs.rmSync(taskDir, { recursive: true, force: true })
  }
}
