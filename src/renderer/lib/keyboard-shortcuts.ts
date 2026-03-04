export type ShortcutCategory = 'navigation' | 'sessions' | 'view' | 'filter'

export interface ShortcutDef {
  id: string
  key: string
  meta?: boolean
  display: string
  requireNoFocus?: boolean
  category?: ShortcutCategory
  description?: string
}

const isMac = navigator.platform.toUpperCase().includes('MAC')
const MOD = isMac ? '\u2318' : 'Ctrl+'

export const SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { id: 'focus-next', key: ']', meta: true, display: `${MOD}]`, category: 'navigation', description: 'Next card' },
  { id: 'focus-prev', key: '[', meta: true, display: `${MOD}[`, category: 'navigation', description: 'Previous card' },
  { id: 'escape', key: 'Escape', display: 'Esc', category: 'navigation', description: 'Close / deselect' },

  // Sessions
  { id: 'new-session', key: 'n', meta: true, display: `${MOD}N`, category: 'sessions', description: 'New session' },
  { id: 'rename', key: 'F2', display: 'F2', category: 'sessions', description: 'Rename session' },

  // View
  { id: 'command-palette', key: 'k', meta: true, display: `${MOD}K`, category: 'view', description: 'Command palette' },
  { id: 'shortcuts-panel', key: '/', meta: true, display: `${MOD}/`, category: 'view', description: 'Keyboard shortcuts' },
  { id: 'settings', key: ',', meta: true, display: `${MOD},`, category: 'view', description: 'Settings' },
  { id: 'toggle-sidebar', key: 'b', meta: true, display: `${MOD}B`, category: 'view', description: 'Toggle sidebar' },

  // Filters
  { id: 'filter-all', key: '1', meta: true, display: `${MOD}1`, category: 'filter', description: 'Show all' },
  { id: 'filter-running', key: '2', meta: true, display: `${MOD}2`, category: 'filter', description: 'Show running' },
  { id: 'filter-waiting', key: '3', meta: true, display: `${MOD}3`, category: 'filter', description: 'Show waiting' },
  { id: 'filter-idle', key: '4', meta: true, display: `${MOD}4`, category: 'filter', description: 'Show idle' },
  { id: 'filter-error', key: '5', meta: true, display: `${MOD}5`, category: 'filter', description: 'Show errors' }
]

export const SHORTCUT_CATEGORIES: { key: ShortcutCategory; label: string }[] = [
  { key: 'navigation', label: 'Navigation' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'view', label: 'View' },
  { key: 'filter', label: 'Filters' }
]

export function getShortcut(id: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.id === id)
}
