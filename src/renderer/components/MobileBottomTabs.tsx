import { Monitor, ListTodo, Plus, Settings } from 'lucide-react'
import { useAppStore } from '../stores'

interface Props {
  /** When true (keyboard open), the tab bar is hidden to maximize screen space. */
  hidden?: boolean
}

/**
 * Bottom tab navigation bar for mobile viewports.
 * Provides thumb-friendly access to the main views: Sessions, Tasks, New, Settings.
 * Hidden when the virtual keyboard is open.
 */
export function MobileBottomTabs({ hidden }: Props) {
  const mainViewMode = useAppStore((s) => s.config?.defaults?.mainViewMode ?? 'sessions')
  const setMainViewMode = useAppStore((s) => s.setMainViewMode)
  const setDialogOpen = useAppStore((s) => s.setNewAgentDialogOpen)
  const setTaskDialogOpen = useAppStore((s) => s.setTaskDialogOpen)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen)

  if (hidden) return null

  const tabs = [
    {
      id: 'sessions' as const,
      label: 'Sessions',
      icon: Monitor,
      active: mainViewMode === 'sessions' && !isSettingsOpen,
      onTap: () => {
        if (isSettingsOpen) setSettingsOpen(false)
        setMainViewMode('sessions')
      }
    },
    {
      id: 'tasks' as const,
      label: 'Tasks',
      icon: ListTodo,
      active: mainViewMode === 'tasks' && !isSettingsOpen,
      onTap: () => {
        if (isSettingsOpen) setSettingsOpen(false)
        setMainViewMode('tasks')
      }
    },
    {
      id: 'new' as const,
      label: 'New',
      icon: Plus,
      active: false,
      isAction: true,
      onTap: () => {
        if (mainViewMode === 'tasks') {
          setTaskDialogOpen(true)
        } else {
          setDialogOpen(true)
        }
      }
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
      active: isSettingsOpen,
      onTap: () => setSettingsOpen(!isSettingsOpen)
    }
  ]

  return (
    <nav
      className="shrink-0 border-t border-white/[0.06] flex items-stretch"
      style={{ background: '#141416' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={tab.onTap}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px]
                       transition-colors relative
                       ${tab.active ? 'text-white' : 'text-gray-500 active:text-gray-300'}
                       ${tab.isAction ? '' : ''}`}
          >
            {/* Active indicator dot */}
            {tab.active && <div className="absolute top-1.5 w-1 h-1 rounded-full bg-cyan-400" />}
            <Icon
              size={tab.isAction ? 22 : 20}
              strokeWidth={tab.active ? 2.2 : 1.8}
              className={tab.isAction ? 'text-cyan-400' : ''}
            />
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
