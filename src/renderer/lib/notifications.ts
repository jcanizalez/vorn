import { AgentStatus, AppConfig } from '../../shared/types'
import { TerminalState } from '../stores/types'
import { getDisplayName } from './terminal-display'
import { AGENT_DEFINITIONS } from './agent-definitions'

export type NotificationReason = 'waiting' | 'error' | 'bell'

const COOLDOWN_MS = 10_000
const lastNotified = new Map<string, number>()

export function shouldNotifyStatus(
  config: AppConfig | null,
  prevStatus: AgentStatus,
  newStatus: AgentStatus
): boolean {
  const prefs = config?.defaults.notifications
  if (!prefs?.enabled) return false

  if (newStatus === 'waiting' && prevStatus !== 'waiting') {
    return prefs.onWaiting !== false
  }
  if (newStatus === 'error' && prevStatus !== 'error') {
    return prefs.onError !== false
  }
  return false
}

export function shouldNotifyBell(config: AppConfig | null): boolean {
  const prefs = config?.defaults.notifications
  return !!prefs?.enabled && prefs.onBell !== false
}

export function sendAgentNotification(
  terminal: TerminalState,
  reason: NotificationReason,
  onClick?: () => void
): void {
  if (Notification.permission !== 'granted') return

  // Don't notify if window is focused
  if (document.hasFocus()) return

  // Cooldown per terminal
  const lastTime = lastNotified.get(terminal.id) ?? 0
  if (Date.now() - lastTime < COOLDOWN_MS) return
  lastNotified.set(terminal.id, Date.now())

  const name = getDisplayName(terminal.session)
  const agent = AGENT_DEFINITIONS[terminal.session.agentType].displayName

  let title: string
  let body: string

  switch (reason) {
    case 'waiting':
      title = `${agent} needs input`
      body = `${name} is waiting for your response`
      break
    case 'error':
      title = `${agent} error`
      body = `${name} encountered an error`
      break
    case 'bell':
      title = `${agent} notification`
      body = `${name} is requesting your attention`
      break
  }

  const notification = new Notification(title, { body, silent: false })
  notification.onclick = () => {
    window.focus()
    onClick?.()
  }
}
