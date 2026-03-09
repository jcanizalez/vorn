import cron from 'node-cron'
import { BrowserWindow } from 'electron'
import { WorkflowDefinition, TriggerConfig, IPC } from '../shared/types'
import { configManager } from './config-manager'
import { scheduleLogManager } from './schedule-log'
import { updateWorkflowRunStatus } from './database'

export interface MissedSchedule {
  workflow: WorkflowDefinition
  scheduledFor: string
}

function getTriggerConfig(wf: WorkflowDefinition): TriggerConfig | null {
  const triggerNode = wf.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return null
  return triggerNode.config as TriggerConfig
}

class Scheduler {
  private cronJobs = new Map<string, cron.ScheduledTask>()
  private timeouts = new Map<string, NodeJS.Timeout>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

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
        const task = cron.schedule(
          trigger.cron,
          () => this.executeWorkflow(wf.id),
          {
            timezone: trigger.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        )
        this.cronJobs.set(wf.id, task)
      }

      if (trigger.triggerType === 'once' && !this.timeouts.has(wf.id)) {
        const runAt = new Date(trigger.runAt).getTime()
        const delay = runAt - Date.now()
        if (delay > 0) {
          const timer = setTimeout(() => this.executeWorkflow(wf.id), delay)
          this.timeouts.set(wf.id, timer)
        }
      }
    }
  }

  private executeWorkflow(workflowId: string): void {
    this.mainWindow?.webContents.send(IPC.SCHEDULER_EXECUTE, { workflowId })

    const config = configManager.loadConfig()
    const wf = config.workflows?.find((w) => w.id === workflowId)
    if (wf) {
      const now = new Date().toISOString()
      const actionCount = wf.nodes.filter((n) => n.type === 'launchAgent').length
      scheduleLogManager.addEntry({
        workflowId,
        workflowName: wf.name,
        executedAt: now,
        status: 'success',
        sessionsLaunched: actionCount
      })

      updateWorkflowRunStatus(workflowId, now, 'success')
      configManager.notifyChanged()
    }

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
