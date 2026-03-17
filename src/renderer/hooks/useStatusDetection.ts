import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores'
import { analyzeOutput, createStatusContext, StatusContext } from '../lib/status-parser'
import { IDLE_TIMEOUT_MS } from '../lib/constants'
import { shouldNotifyStatus, shouldNotifyBell, sendAgentNotification } from '../lib/notifications'
import { registerStatusHandler } from '../lib/terminal-registry'

export function useStatusDetection(terminalId: string) {
  const updateStatus = useAppStore((s) => s.updateStatus)
  const ctxRef = useRef<StatusContext>(createStatusContext())
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unregister = registerStatusHandler(terminalId, (data) => {
      // Skip pattern-based status detection when hooks are providing status
      const terminal = useAppStore.getState().terminals.get(terminalId)
      const useHooks = terminal?.session.statusSource === 'hooks'

      if (!useHooks) {
        const ctx = ctxRef.current
        const newStatus = analyzeOutput(ctx, data)

        if (newStatus !== ctx.currentStatus) {
          const prevStatus = ctx.currentStatus
          ctx.currentStatus = newStatus
          updateStatus(terminalId, newStatus)

          // Notify on status transitions (waiting/error)
          const state = useAppStore.getState()
          const t = state.terminals.get(terminalId)
          if (t && shouldNotifyStatus(state.config, prevStatus, newStatus)) {
            sendAgentNotification(
              t,
              newStatus === 'waiting' ? 'waiting' : 'error',
              state.config,
              () => useAppStore.getState().setFocusedTerminal(terminalId)
            )
          }
        }
      }

      // Bell detection (always active regardless of status source)
      if (data.includes('\x07')) {
        const state = useAppStore.getState()
        const t = state.terminals.get(terminalId)
        if (t && shouldNotifyBell(state.config)) {
          sendAgentNotification(t, 'bell', state.config, () =>
            useAppStore.getState().setFocusedTerminal(terminalId)
          )
        }
      }

      if (!useHooks) {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          const ctx = ctxRef.current
          if (ctx.currentStatus === 'running') {
            ctx.currentStatus = 'idle'
            updateStatus(terminalId, 'idle')
          }
        }, IDLE_TIMEOUT_MS)
      }
    })

    return () => {
      unregister()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [terminalId, updateStatus])
}
