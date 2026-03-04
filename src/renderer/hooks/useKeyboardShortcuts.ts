import { useEffect } from 'react'
import { useAppStore } from '../stores'
import { StatusFilter } from '../stores/types'

const STATUS_FILTERS: StatusFilter[] = ['all', 'running', 'waiting', 'idle', 'error']

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const state = useAppStore.getState()

      // Escape chain — layered dismiss
      if (e.key === 'Escape') {
        if (state.isCommandPaletteOpen) {
          state.setCommandPaletteOpen(false)
          return
        }
        if (state.isShortcutsPanelOpen) {
          state.setShortcutsPanelOpen(false)
          return
        }
        if (state.isSettingsOpen) {
          state.setSettingsOpen(false)
          return
        }
        if (state.renamingTerminalId) {
          state.setRenamingTerminalId(null)
          return
        }
        if (state.focusedTerminalId) {
          // Close overlay, preserve selection on the card that was expanded
          state.setSelectedTerminal(state.focusedTerminalId)
          state.setFocusedTerminal(null)
          return
        }
        if (state.selectedTerminalId) {
          state.setSelectedTerminal(null)
          return
        }
        return
      }

      // Cmd+K — command palette
      if (e.metaKey && e.key === 'k') {
        e.preventDefault()
        state.setCommandPaletteOpen(!state.isCommandPaletteOpen)
        return
      }

      // Cmd+? — keyboard shortcuts panel
      if (e.metaKey && e.key === '?') {
        e.preventDefault()
        state.setShortcutsPanelOpen(!state.isShortcutsPanelOpen)
        return
      }

      // Cmd+, — settings
      if (e.metaKey && e.key === ',') {
        e.preventDefault()
        state.setSettingsOpen(true)
        return
      }

      // Cmd+N — new session
      if (e.metaKey && e.key === 'n') {
        e.preventDefault()
        state.setNewAgentDialogOpen(true)
        return
      }

      // Cmd+B — toggle sidebar
      if (e.metaKey && e.key === 'b') {
        e.preventDefault()
        state.toggleSidebar()
        return
      }

      // Cmd+] — next terminal
      if (e.metaKey && e.key === ']') {
        e.preventDefault()
        const ids = state.visibleTerminalIds
        if (ids.length === 0) return
        if (state.focusedTerminalId) {
          // In overlay: cycle which terminal is expanded
          const current = ids.indexOf(state.focusedTerminalId)
          const next = current === -1 ? 0 : (current + 1) % ids.length
          state.setFocusedTerminal(ids[next])
        } else {
          // In grid: cycle selection
          const currentSel = state.selectedTerminalId
          if (!currentSel) {
            state.setSelectedTerminal(ids[0])
          } else {
            const current = ids.indexOf(currentSel)
            const next = current === -1 ? 0 : (current + 1) % ids.length
            state.setSelectedTerminal(ids[next])
          }
        }
        return
      }

      // Cmd+[ — previous terminal
      if (e.metaKey && e.key === '[') {
        e.preventDefault()
        const ids = state.visibleTerminalIds
        if (ids.length === 0) return
        if (state.focusedTerminalId) {
          // In overlay: cycle which terminal is expanded
          const current = ids.indexOf(state.focusedTerminalId)
          const prev = current === -1 ? ids.length - 1 : (current - 1 + ids.length) % ids.length
          state.setFocusedTerminal(ids[prev])
        } else {
          // In grid: cycle selection
          const currentSel = state.selectedTerminalId
          if (!currentSel) {
            state.setSelectedTerminal(ids[ids.length - 1])
          } else {
            const current = ids.indexOf(currentSel)
            const prev = current === -1 ? ids.length - 1 : (current - 1 + ids.length) % ids.length
            state.setSelectedTerminal(ids[prev])
          }
        }
        return
      }

      // Cmd+1-5 — status filters
      if (e.metaKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (index < STATUS_FILTERS.length) {
          state.setStatusFilter(STATUS_FILTERS[index])
        }
        return
      }

      // F2 — rename focused or selected terminal
      if (e.key === 'F2') {
        const targetId = state.focusedTerminalId || state.selectedTerminalId
        if (targetId) {
          e.preventDefault()
          state.setRenamingTerminalId(targetId)
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
