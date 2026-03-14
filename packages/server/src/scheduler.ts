import cron from 'node-cron'
import { EventEmitter } from 'node:events'
import { WorkflowDefinition, TriggerConfig, IPC } from '@vibegrid/shared/types'
import { configManager } from './config-manager'
import log from './logger'

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
      if (!wf.enabled) continue
      const trigger = getTriggerConfig(wf)
      if (!trigger) continue

      if (trigger.triggerType === 'recurring' && !this.cronJobs.has(wf.id)) {
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
