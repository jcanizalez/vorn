import { spawn } from 'node:child_process'
import { ScriptConfig } from '@vibegrid/shared/types'
import log from './logger'

export interface ScriptExecutionResult {
  success: boolean
  output: string
  error?: string
  exitCode?: number
}

export async function executeScript(config: ScriptConfig): Promise<ScriptExecutionResult> {
  return new Promise((resolve) => {
    let command: string
    let args: string[]

    switch (config.scriptType) {
      case 'bash':
        command = 'bash'
        // Run from stdin
        args = ['-s']
        break
      case 'powershell':
        command = 'powershell'
        args = ['-Command', '-']
        break
      case 'python':
        command = 'python3'
        args = ['-']
        break
      case 'node':
        command = 'node'
        args = ['-']
        break
      default:
        resolve({
          success: false,
          output: '',
          error: `Unsupported script type: ${config.scriptType}`
        })
        return
    }

    if (config.args && config.args.length > 0) {
      // Append user args if the interpreter supports it (bash -s arg1 arg2)
      args.push(...config.args)
    }

    const cwd = config.cwd || config.projectPath || process.cwd()

    log.info(`[script-runner] executing ${config.scriptType} script in ${cwd}`)

    const child = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env // Inherit environment
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      log.error(`[script-runner] spawn error: ${err.message}`)
      resolve({
        success: false,
        output: stdout,
        error: err.message
      })
    })

    child.on('close', (code) => {
      log.info(`[script-runner] exited with code ${code}`)
      resolve({
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr || `Exited with code ${code}` : undefined,
        exitCode: code ?? undefined
      })
    })

    // Write script content to stdin
    child.stdin.write(config.scriptContent)
    child.stdin.end()
  })
}
