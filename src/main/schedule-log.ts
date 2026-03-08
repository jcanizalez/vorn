import { ScheduleLogEntry } from '../shared/types'
import {
  addScheduleLogEntry as dbAddEntry,
  getScheduleLogEntries as dbGetEntries,
  clearScheduleLog as dbClear
} from './database'

class ScheduleLogManager {
  addEntry(entry: ScheduleLogEntry): void {
    try {
      dbAddEntry(entry)
    } catch {
      // ignore write errors
    }
  }

  getEntries(workflowId?: string): ScheduleLogEntry[] {
    try {
      return dbGetEntries(workflowId)
    } catch {
      return []
    }
  }

  clear(): void {
    try {
      dbClear()
    } catch {
      // ignore
    }
  }
}

export const scheduleLogManager = new ScheduleLogManager()
