import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ScheduleLogEntry } from '../shared/types'

const LOG_PATH = path.join(os.homedir(), '.vibegrid', 'schedule-log.json')
const MAX_ENTRIES = 200

class ScheduleLogManager {
  addEntry(entry: ScheduleLogEntry): void {
    const entries = this.getEntries()
    entries.push(entry)
    // Trim to max
    while (entries.length > MAX_ENTRIES) {
      entries.shift()
    }
    try {
      fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2), 'utf-8')
    } catch {
      // ignore write errors
    }
  }

  getEntries(workflowId?: string): ScheduleLogEntry[] {
    try {
      if (!fs.existsSync(LOG_PATH)) return []
      const raw = fs.readFileSync(LOG_PATH, 'utf-8')
      const entries: ScheduleLogEntry[] = JSON.parse(raw)
      if (workflowId) {
        return entries.filter((e) => e.workflowId === workflowId)
      }
      return entries
    } catch {
      return []
    }
  }

  clear(): void {
    try {
      if (fs.existsSync(LOG_PATH)) {
        fs.unlinkSync(LOG_PATH)
      }
    } catch {
      // ignore
    }
  }
}

export const scheduleLogManager = new ScheduleLogManager()
