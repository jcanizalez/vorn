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

export const SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { id: 'focus-next', key: ']', meta: true, display: '\u2318]', category: 'navigation', description: 'Next card' },
  { id: 'focus-prev', key: '[', meta: true, display: '\u2318[', category: 'navigation', description: 'Previous card' },
  { id: 'escape', key: 'Escape', display: 'Esc', category: 'navigation', description: 'Close / deselect' },

  // Sessions
  { id: 'new-session', key: 'n', meta: true, display: '\u2318N', category: 'sessions', description: 'New session' },
  { id: 'rename', key: 'F2', display: 'F2', category: 'sessions', description: 'Rename session' },

  // View
  { id: 'command-palette', key: 'k', meta: true, display: '\u2318K', category: 'view', description: 'Command palette' },
  { id: 'shortcuts-panel', key: '?', meta: true, display: '\u2318?', category: 'view', description: 'Keyboard shortcuts' },
  { id: 'settings', key: ',', meta: true, display: '\u2318,', category: 'view', description: 'Settings' },
  { id: 'toggle-sidebar', key: 'b', meta: true, display: '\u2318B', category: 'view', description: 'Toggle sidebar' },

  // Filters
  { id: 'filter-all', key: '1', meta: true, display: '\u23181', category: 'filter', description: 'Show all' },
  { id: 'filter-running', key: '2', meta: true, display: '\u23182', category: 'filter', description: 'Show running' },
  { id: 'filter-waiting', key: '3', meta: true, display: '\u23183', category: 'filter', description: 'Show waiting' },
  { id: 'filter-idle', key: '4', meta: true, display: '\u23184', category: 'filter', description: 'Show idle' },
  { id: 'filter-error', key: '5', meta: true, display: '\u23185', category: 'filter', description: 'Show errors' }
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
