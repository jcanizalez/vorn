import cron from 'node-cron'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { EventEmitter } from 'node:events'
import { WorkflowDefinition, TriggerConfig, IPC } from '@vornrun/shared/types'
import { configManager } from './config-manager'
import log from './logger'

const LOCK_DIR = path.join(os.homedir(), '.vorn')

/**
 * Try to acquire an execution lock for a workflow run.
 * Uses exclusive file creation (wx flag) keyed by the current minute
 * so it's atomic across processes and auto-expires for the next run.
 */
function acquireExecutionLock(workflowId: string): boolean {
  // Key by current minute so the lock naturally expires for the next scheduled run
  const minuteKey = Math.floor(Date.now() / 60_000)
  const lockFile = path.join(LOCK_DIR, `scheduler-${workflowId}-${minuteKey}.lock`)
  try {
    // wx flag: exclusive create — fails if file already exists (atomic)
    fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' })
    // Clean up stale lock files from previous runs
    cleanStaleLocks(workflowId, minuteKey)
    return true
  } catch {
    return false // Another instance already created this lock
  }
}

function cleanStaleLocks(workflowId: string, currentKey: number): void {
  try {
    const prefix = `scheduler-${workflowId}-`
    for (const f of fs.readdirSync(LOCK_DIR)) {
      if (f.startsWith(prefix) && f.endsWith('.lock')) {
        const key = parseInt(f.slice(prefix.length, -5), 10)
        if (!isNaN(key) && key < currentKey) {
          fs.unlinkSync(path.join(LOCK_DIR, f))
        }
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

export interface MissedSchedule {
  workflow: WorkflowDefinition
  scheduledFor: string
}

function getTriggerConfig(wf: WorkflowDefinition): TriggerConfig | null {
  const triggerNode = wf.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return null
  return triggerNode.config as TriggerConfig
}

class Scheduler extends EventEmitter {
  private cronJobs = new Map<string, cron.ScheduledTask>()
  private timeouts = new Map<string, NodeJS.Timeout>()

  syncSchedules(workflows: WorkflowDefinition[]): void {
    log.info(
      `[scheduler] syncing ${workflows.length} workflows (active crons: ${this.cronJobs.size}, timeouts: ${this.timeouts.size})`
    )

    // Cancel jobs for workflows that no longer exist or are disabled
    for (const [id] of this.cronJobs) {
      const wf = workflows.find((w) => w.id === id)
      const trigger = wf ? getTriggerConfig(wf) : null
      if (!wf || !wf.enabled || trigger?.triggerType !== 'recurring') {
        this.cronJobs.get(id)?.stop()
        this.cronJobs.delete(id)
      }
    }
    for (const [id] of this.timeouts) {
      const wf = workflows.find((w) => w.id === id)
      const trigger = wf ? getTriggerConfig(wf) : null
      if (!wf || !wf.enabled || trigger?.triggerType !== 'once') {
        clearTimeout(this.timeouts.get(id)!)
        this.timeouts.delete(id)
      }
    }

    // Register new/updated schedules
    for (const wf of workflows) {
      if (!wf.enabled) {
        log.info(`[scheduler] skipping disabled workflow "${wf.name}"`)
        continue
      }
      const trigger = getTriggerConfig(wf)
      if (!trigger) {
        log.info(`[scheduler] no trigger node for workflow "${wf.name}"`)
        continue
      }
      log.info(`[scheduler] workflow "${wf.name}" trigger=${trigger.triggerType}`)

      if (trigger.triggerType === 'recurring' && !this.cronJobs.has(wf.id)) {
        log.info(
          `[scheduler] registering recurring workflow "${wf.name}" cron="${trigger.cron}" enabled=${wf.enabled}`
        )
        if (!cron.validate(trigger.cron)) {
          log.error(
            `[scheduler] invalid cron expression for workflow "${wf.name}": ${trigger.cron}`
          )
          continue
        }
        try {
          const task = cron.schedule(trigger.cron, () => this.executeWorkflow(wf.id), {
            timezone: trigger.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          })
          this.cronJobs.set(wf.id, task)
        } catch (err) {
          log.error(`[scheduler] failed to schedule workflow "${wf.name}":`, err)
        }
      }

      if (trigger.triggerType === 'once' && !this.timeouts.has(wf.id)) {
        const runAt = new Date(trigger.runAt).getTime()
        if (isNaN(runAt)) {
          log.error(`[scheduler] invalid runAt date for workflow "${wf.name}": ${trigger.runAt}`)
          continue
        }
        const delay = runAt - Date.now()
        if (delay > 0) {
          // Cap delay to 24 hours to avoid setTimeout overflow (max ~24.8 days)
          // The scheduler will re-evaluate on next syncSchedules call
          const MAX_DELAY = 24 * 60 * 60 * 1000
          const safeDelay = Math.min(delay, MAX_DELAY)
          const timer = setTimeout(() => {
            if (safeDelay < delay) {
              // Re-schedule: not yet time to fire
              this.timeouts.delete(wf.id)
              this.syncSchedules(configManager.loadConfig().workflows ?? [])
            } else {
              this.executeWorkflow(wf.id)
            }
          }, safeDelay)
          this.timeouts.set(wf.id, timer)
        }
      }
    }
  }

  private executeWorkflow(workflowId: string): void {
    if (!acquireExecutionLock(workflowId)) {
      log.info(`[scheduler] skipping workflow ${workflowId} — already executed by another instance`)
      this.timeouts.delete(workflowId)
      return
    }
    log.info(`[scheduler] executing workflow ${workflowId}`)
    this.emit('client-message', IPC.SCHEDULER_EXECUTE, { workflowId })
    this.timeouts.delete(workflowId)
  }

  checkMissedSchedules(workflows: WorkflowDefinition[]): MissedSchedule[] {
    const missed: MissedSchedule[] = []
    for (const wf of workflows) {
      if (!wf.enabled) continue
      const trigger = getTriggerConfig(wf)
      if (trigger?.triggerType === 'once') {
        const runAt = new Date(trigger.runAt).getTime()
        if (runAt < Date.now() && !wf.lastRunAt) {
          missed.push({ workflow: wf, scheduledFor: trigger.runAt })
        }
      }
    }
    return missed
  }

  getNextRun(workflowId: string, workflows: WorkflowDefinition[]): string | null {
    const wf = workflows.find((w) => w.id === workflowId)
    if (!wf || !wf.enabled) return null
    const trigger = getTriggerConfig(wf)
    if (!trigger) return null

    if (trigger.triggerType === 'once') {
      const runAt = new Date(trigger.runAt).getTime()
      return runAt > Date.now() ? trigger.runAt : null
    }

    if (trigger.triggerType === 'recurring') {
      return trigger.cron
    }

    return null
  }

  stopAll(): void {
    for (const [, job] of this.cronJobs) job.stop()
    for (const [, timer] of this.timeouts) clearTimeout(timer)
    this.cronJobs.clear()
    this.timeouts.clear()
  }
}

export const scheduler = new Scheduler()
