import cron from 'node-cron'
import { BrowserWindow } from 'electron'
import { WorkflowConfig, IPC } from '../shared/types'
import { configManager } from './config-manager'
import { scheduleLogManager } from './schedule-log'
import { updateWorkflowRunStatus } from './database'

export interface MissedSchedule {
  workflow: WorkflowConfig
  scheduledFor: string
}

class Scheduler {
  private cronJobs = new Map<string, cron.ScheduledTask>()
  private timeouts = new Map<string, NodeJS.Timeout>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  /**
   * Called on app start and whenever config changes.
   * Diffs current jobs against config and reconciles.
   */
  syncSchedules(workflows: WorkflowConfig[]): void {
    // Cancel jobs for workflows that no longer exist or are disabled
    for (const [id] of this.cronJobs) {
      const wf = workflows.find((w) => w.id === id)
      if (!wf || !wf.enabled || wf.schedule.type !== 'recurring') {
        this.cronJobs.get(id)?.stop()
        this.cronJobs.delete(id)
      }
    }
    for (const [id] of this.timeouts) {
      const wf = workflows.find((w) => w.id === id)
      if (!wf || !wf.enabled || wf.schedule.type !== 'once') {
        clearTimeout(this.timeouts.get(id)!)
        this.timeouts.delete(id)
      }
    }

    // Register new/updated schedules
    for (const wf of workflows) {
      if (!wf.enabled) continue

      if (wf.schedule.type === 'recurring' && !this.cronJobs.has(wf.id)) {
        const task = cron.schedule(
          wf.schedule.cron,
          () => this.executeWorkflow(wf.id),
          {
            timezone: wf.schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        )
        this.cronJobs.set(wf.id, task)
      }

      if (wf.schedule.type === 'once' && !this.timeouts.has(wf.id)) {
        const runAt = new Date(wf.schedule.runAt).getTime()
        const delay = runAt - Date.now()
        if (delay > 0) {
          const timer = setTimeout(() => this.executeWorkflow(wf.id), delay)
          this.timeouts.set(wf.id, timer)
        }
        // If delay <= 0, it was missed — handled by checkMissedSchedules
      }
    }
  }

  private executeWorkflow(workflowId: string): void {
    // Tell the renderer to execute the workflow actions
    this.mainWindow?.webContents.send(IPC.SCHEDULER_EXECUTE, { workflowId })

    // Log execution and update workflow run status
    const config = configManager.loadConfig()
    const wf = config.shortcuts?.find((s) => s.id === workflowId)
    if (wf) {
      const now = new Date().toISOString()
      scheduleLogManager.addEntry({
        workflowId,
        workflowName: wf.name,
        executedAt: now,
        status: 'success',
        sessionsLaunched: wf.actions.length
      })

      updateWorkflowRunStatus(workflowId, now, 'success')
      configManager.notifyChanged()
    }

    // Clean up one-time schedules
    this.timeouts.delete(workflowId)
  }

  /**
   * Called on app startup to detect one-time schedules that were missed
   * (i.e., their runAt has passed but they were never executed).
   */
  checkMissedSchedules(workflows: WorkflowConfig[]): MissedSchedule[] {
    const missed: MissedSchedule[] = []
    for (const wf of workflows) {
      if (!wf.enabled) continue
      if (wf.schedule.type === 'once') {
        const runAt = new Date(wf.schedule.runAt).getTime()
        if (runAt < Date.now() && !wf.lastRunAt) {
          missed.push({ workflow: wf, scheduledFor: wf.schedule.runAt })
        }
      }
    }
    return missed
  }

  /**
   * Get the next run time for a workflow (for display purposes).
   */
  getNextRun(workflowId: string, workflows: WorkflowConfig[]): string | null {
    const wf = workflows.find((w) => w.id === workflowId)
    if (!wf || !wf.enabled) return null

    if (wf.schedule.type === 'once') {
      const runAt = new Date(wf.schedule.runAt).getTime()
      return runAt > Date.now() ? wf.schedule.runAt : null
    }

    if (wf.schedule.type === 'recurring') {
      // Use cron-parser to compute next occurrence if available,
      // otherwise return the cron expression as a hint
      return wf.schedule.cron
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
