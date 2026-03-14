import { useState } from 'react'
import { Monitor, ListTodo, Settings, LogOut } from 'lucide-react'
import type { AppConfig, TerminalSession } from '@vibegrid/shared/types'
import type { WsClient } from '../api/ws-client'
import { SessionsView } from './SessionsView'
import { TasksView } from './TasksView'

type Tab = 'sessions' | 'tasks' | 'settings'

interface MobileLayoutProps {
  config: AppConfig | null
  sessions: TerminalSession[]
  client: WsClient | null
  onDisconnect: () => void
}

export function MobileLayout({ config, sessions, client, onDisconnect }: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sessions')

  const tabs: { id: Tab; label: string; icon: typeof Monitor }[] = [
    { id: 'sessions', label: 'Sessions', icon: Monitor },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-white">VibeGrid</h1>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
        </div>
        <span className="text-xs text-gray-500">
          {config?.projects.length ?? 0} project{(config?.projects.length ?? 0) !== 1 ? 's' : ''}
        </span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'sessions' && (
          <SessionsView sessions={sessions} config={config} client={client} />
        )}
        {activeTab === 'tasks' && <TasksView config={config} client={client} />}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-4">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Settings</h2>

            <div className="space-y-2">
              <div className="bg-white/[0.06] border border-white/[0.06] rounded-xl p-4">
                <div className="text-sm text-gray-400">Server</div>
                <div className="text-sm text-white mt-1 font-mono">
                  {localStorage.getItem('vibegrid-server-url') ?? 'Unknown'}
                </div>
              </div>

              <div className="bg-white/[0.06] border border-white/[0.06] rounded-xl p-4">
                <div className="text-sm text-gray-400">Theme</div>
                <div className="text-sm text-white mt-1">{config?.defaults.theme ?? 'dark'}</div>
              </div>

              <div className="bg-white/[0.06] border border-white/[0.06] rounded-xl p-4">
                <div className="text-sm text-gray-400">Default Agent</div>
                <div className="text-sm text-white mt-1">
                  {config?.defaults.defaultAgent ?? 'claude'}
                </div>
              </div>
            </div>

            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 w-full py-3 px-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="flex border-t border-white/[0.06] bg-surface-raised safe-area-pb">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 pt-3 transition-colors ${
                active ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
