export interface StatusContext {
  lastOutputTime: number
  outputBuffer: string
}

export function createStatusContext(): StatusContext {
  return {
    lastOutputTime: Date.now(),
    outputBuffer: ''
  }
}

const WAITING_PATTERNS = [
  /\$\s*$/,
  /❯\s*$/,
  />\s*$/,
  /\(y\/n\)/i,
  /\?\s*$/,
  /Enter .*:/i,
  /waiting for input/i,
  /\]\$\s*$/
]

const ERROR_PATTERNS = [
  /^error:/im,
  /^Error:/m,
  /FATAL/,
  /panic:/,
  /Traceback/,
  /command not found/,
  /ENOENT/,
  /EACCES/
]

import type { AgentStatus } from '@vornrun/shared/types'

export function analyzeOutput(ctx: StatusContext, newData: string): AgentStatus {
  ctx.lastOutputTime = Date.now()
  ctx.outputBuffer = (ctx.outputBuffer + newData).slice(-2000)

  const recentLines = ctx.outputBuffer.split('\n').slice(-5).join('\n')

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(recentLines)) {
      return 'error'
    }
  }

  const lastLine = ctx.outputBuffer.trimEnd().split('\n').pop() || ''
  for (const pattern of WAITING_PATTERNS) {
    if (pattern.test(lastLine)) {
      return 'waiting'
    }
  }

  return 'running'
}
