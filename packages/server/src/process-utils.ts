import { execFileSync } from 'node:child_process'

function getUserShellEnv(): Record<string, string> {
  if (process.platform === 'win32') return { ...process.env } as Record<string, string>
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const output = execFileSync(shell, ['-ilc', 'env'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe']
    })
    const env: Record<string, string> = {}
    for (const line of output.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) {
        env[line.substring(0, idx)] = line.substring(idx + 1)
      }
    }
    return env
  } catch {
    return { ...process.env } as Record<string, string>
  }
}

const resolvedEnv = getUserShellEnv()

export function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/zsh'
}

export function shellEscape(s: string): string {
  // Skip quoting for simple safe strings (flags, paths without spaces, etc.)
  if (/^[a-zA-Z0-9_./:=@%+,-]+$/.test(s)) return s
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

export const SENSITIVE_ENV_PREFIXES = [
  'AWS_SECRET',
  'AWS_SESSION',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'OPENAI_API',
  'ANTHROPIC_API',
  'GOOGLE_API',
  'STRIPE_',
  'DATABASE_URL',
  'DB_PASSWORD',
  'SECRET_',
  'PRIVATE_KEY',
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN'
]

// Env vars to strip so agent CLIs don't refuse to launch (e.g. nested session detection)
export const STRIP_ENV_KEYS = ['CLAUDECODE']

export function getSafeEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, val] of Object.entries(resolvedEnv)) {
    if (val === undefined) continue
    if (SENSITIVE_ENV_PREFIXES.some((p) => key.toUpperCase().startsWith(p))) continue
    if (STRIP_ENV_KEYS.includes(key)) continue
    env[key] = val
  }
  return env
}
