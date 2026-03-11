import { ScheduleLogEntry } from '../shared/types'
import {
  addScheduleLogEntry as dbAddEntry,
  getScheduleLogEntries as dbGetEntries,
  clearScheduleLog as dbClear
} from './database'
import log from './logger'

class ScheduleLogManager {
  addEntry(entry: ScheduleLogEntry): void {
    try {
      dbAddEntry(entry)
    } catch (err) {
      log.warn('[schedule-log] addEntry failed:', err)
    }
  }

  getEntries(workflowId?: string): ScheduleLogEntry[] {
    try {
      return dbGetEntries(workflowId)
    } catch (err) {
      log.warn('[schedule-log] getEntries failed:', err)
      return []
    }
  }

  clear(): void {
    try {
      dbClear()
    } catch (err) {
      log.warn('[schedule-log] clear failed:', err)
    }
  }
}

export const scheduleLogManager = new ScheduleLogManager()
