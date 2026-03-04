import { motion } from 'framer-motion'
import { useAppStore } from '../stores'
import { SettingsCategory } from '../stores/types'
import { GeneralSettings } from './settings/GeneralSettings'
import { AgentSettings } from './settings/AgentSettings'
import { HostSettings } from './settings/HostSettings'

const CATEGORIES: { key: SettingsCategory; label: string; icon: React.ReactNode }[] = [
  {
    key: 'general',
    label: 'General',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    )
  },
  {
    key: 'agents',
    label: 'Coding Agents',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  },
  {
    key: 'hosts',
    label: 'Remote Hosts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="6" cy="18" r="1" fill="currentColor" />
      </svg>
    )
  }
]

export function SettingsPage() {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const settingsCategory = useAppStore((s) => s.settingsCategory)
  const setSettingsCategory = useAppStore((s) => s.setSettingsCategory)

  return (
    <motion.div
      className="fixed inset-0 z-40 flex"
      style={{ background: 'rgba(6, 10, 20, 0.98)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Left sidebar */}
      <div className="w-56 border-r border-white/[0.06] flex flex-col shrink-0"
           style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
        {/* Header — pl-[78px] for macOS traffic light safe zone */}
        <div className="titlebar-drag h-[52px] pl-[78px] pr-3 flex items-center border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => setSettingsOpen(false)}
            className="titlebar-no-drag flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to app
          </button>
        </div>

        {/* Categories */}
        <div className="flex-1 px-3 pt-4 space-y-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSettingsCategory(cat.key)}
              className={`w-full text-left px-3 py-2 rounded-md text-[13px] transition-colors flex items-center gap-2.5 ${
                settingsCategory === cat.key
                  ? 'bg-white/[0.08] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {settingsCategory === 'general' && <GeneralSettings />}
          {settingsCategory === 'agents' && <AgentSettings />}
          {settingsCategory === 'hosts' && <HostSettings />}
        </div>
      </div>
    </motion.div>
  )
}
