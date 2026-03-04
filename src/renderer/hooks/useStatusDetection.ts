import { useEffect, useRef } from 'react'
import { useAppStore } from '../stores'
import { analyzeOutput, createStatusContext, StatusContext } from '../lib/status-parser'
import { IDLE_TIMEOUT_MS } from '../lib/constants'
import { shouldNotifyStatus, shouldNotifyBell, sendAgentNotification } from '../lib/notifications'

export function useStatusDetection(terminalId: string) {
  const updateStatus = useAppStore((s) => s.updateStatus)
  const ctxRef = useRef<StatusContext>(createStatusContext())
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const removeListener = window.api.onTerminalData(({ id, data }) => {
      if (id !== terminalId) return

      const ctx = ctxRef.current
      const newStatus = analyzeOutput(ctx, data)

      if (newStatus !== ctx.currentStatus) {
        const prevStatus = ctx.currentStatus
        ctx.currentStatus = newStatus
        updateStatus(terminalId, newStatus)

        // Notify on status transitions (waiting/error)
        const state = useAppStore.getState()
        const terminal = state.terminals.get(terminalId)
        if (terminal && shouldNotifyStatus(state.config, prevStatus, newStatus)) {
          sendAgentNotification(
            terminal,
            newStatus === 'waiting' ? 'waiting' : 'error',
            () => useAppStore.getState().setFocusedTerminal(terminalId)
          )
        }
      }

      // Bell detection
      if (data.includes('\x07')) {
        const state = useAppStore.getState()
        const terminal = state.terminals.get(terminalId)
        if (terminal && shouldNotifyBell(state.config)) {
          sendAgentNotification(
            terminal,
            'bell',
            () => useAppStore.getState().setFocusedTerminal(terminalId)
          )
        }
      }

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        if (ctx.currentStatus === 'running') {
          ctx.currentStatus = 'idle'
          updateStatus(terminalId, 'idle')
        }
      }, IDLE_TIMEOUT_MS)
    })

    return () => {
      removeListener()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [terminalId, updateStatus])
}
