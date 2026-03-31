import { useEffect } from 'react'
import { useAppStore } from '../stores'
import { shouldNotifyBell, sendAgentNotification } from '../lib/notifications'
import { registerStatusHandler } from '../lib/terminal-registry'

export function useStatusDetection(terminalId: string) {
  useEffect(() => {
    const unregister = registerStatusHandler(terminalId, (data) => {
      // Bell detection — notify when terminal sends BEL character
      if (data.includes('\x07')) {
        const state = useAppStore.getState()
        const t = state.terminals.get(terminalId)
        if (t && shouldNotifyBell(state.config)) {
          sendAgentNotification(t, 'bell', state.config, () =>
            useAppStore.getState().setFocusedTerminal(terminalId)
          )
        }
      }
    })

    return () => {
      unregister()
    }
  }, [terminalId])
}
