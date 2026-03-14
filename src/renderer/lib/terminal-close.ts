import { useAppStore } from '../stores'
import { destroyTerminal } from './terminal-registry'

const pendingTerminalCloses = new Set<string>()

export function consumePendingTerminalClose(id: string): boolean {
  const pending = pendingTerminalCloses.has(id)
  if (pending) pendingTerminalCloses.delete(id)
  return pending
}

export async function closeTerminalSession(id: string): Promise<void> {
  const state = useAppStore.getState()
  pendingTerminalCloses.add(id)
  if (state.focusedTerminalId === id) state.setFocusedTerminal(null)
  if (state.selectedTerminalId === id) state.setSelectedTerminal(null)
  if (state.renamingTerminalId === id) state.setRenamingTerminalId(null)
  destroyTerminal(id)
  state.removeTerminal(id)

  try {
    await window.api.killTerminal(id)
  } catch (err) {
    console.warn(`[terminal-close] killTerminal failed for ${id}:`, err)
  }
}
