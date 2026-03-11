import { useAppStore } from '../../stores'
import { setAllTerminalsFontSize } from '../../lib/terminal-registry'
import { AGENT_LIST } from '../../lib/agent-definitions'
import { AgentIcon } from '../AgentIcon'
import { AgentType, NotificationConfig, TaskViewMode } from '../../../shared/types'
import { playNotificationSound } from '../../lib/notifications'

function NotificationToggle({
  label,
  description,
  checked,
  onChange,
  disabled
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between py-4 border-b border-white/[0.06] ${disabled ? 'opacity-40' : ''}`}>
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`w-10 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-blue-500' : 'bg-white/[0.1]'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

const DEFAULT_NOTIFICATIONS: NotificationConfig = {
  enabled: false,
  onWaiting: true,
  onError: true,
  onBell: true
}

export function GeneralSettings() {
  const config = useAppStore((s) => s.config)
  const setConfig = useAppStore((s) => s.setConfig)
  const rowHeight = useAppStore((s) => s.rowHeight)
  const setRowHeight = useAppStore((s) => s.setRowHeight)

  if (!config) return null

  const notifications = { ...DEFAULT_NOTIFICATIONS, ...config.defaults.notifications }

  const updateDefaults = (patch: Partial<typeof config.defaults>): void => {
    const updated = {
      ...config,
      defaults: { ...config.defaults, ...patch }
    }
    window.api.saveConfig(updated)
    setConfig(updated)

    // Apply font size change to live terminals
    if (patch.fontSize !== undefined) {
      setAllTerminalsFontSize(patch.fontSize)
    }
  }

  const updateNotifications = (patch: Partial<NotificationConfig>): void => {
    updateDefaults({ notifications: { ...notifications, ...patch } })
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-1">General</h2>
      <p className="text-sm text-gray-500 mb-6">Application preferences and defaults</p>

      <div className="space-y-1">
        {/* Font Size */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Font Size</div>
            <div className="text-xs text-gray-500 mt-0.5">Terminal font size in pixels</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateDefaults({ fontSize: Math.max(8, config.defaults.fontSize - 1) })}
              className="w-7 h-7 flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.1]
                         rounded-md text-gray-300 transition-colors text-sm"
            >
              -
            </button>
            <span className="text-sm text-gray-200 w-8 text-center">{config.defaults.fontSize}</span>
            <button
              onClick={() => updateDefaults({ fontSize: Math.min(24, config.defaults.fontSize + 1) })}
              className="w-7 h-7 flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.1]
                         rounded-md text-gray-300 transition-colors text-sm"
            >
              +
            </button>
          </div>
        </div>

        {/* Default Coding Agent */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Default Coding Agent</div>
            <div className="text-xs text-gray-500 mt-0.5">Pre-selected agent when creating new sessions</div>
          </div>
          <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
            {AGENT_LIST.map((agent) => (
              <button
                key={agent.type}
                onClick={() => updateDefaults({ defaultAgent: agent.type as AgentType })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                  (config.defaults.defaultAgent || 'claude') === agent.type
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title={agent.displayName}
              >
                <AgentIcon agentType={agent.type} size={14} />
                <span className="hidden sm:inline">{agent.displayName.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default Shell */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Default Shell</div>
            <div className="text-xs text-gray-500 mt-0.5">Shell used for terminal sessions</div>
          </div>
          <input
            type="text"
            value={config.defaults.shell}
            onChange={(e) => updateDefaults({ shell: e.target.value })}
            className="w-48 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-md text-sm
                       text-gray-200 focus:border-white/[0.15] focus:outline-none"
          />
        </div>

        {/* Row Height */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Card Row Height</div>
            <div className="text-xs text-gray-500 mt-0.5">Terminal card height in pixels ({rowHeight}px)</div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={100}
              max={600}
              value={rowHeight}
              onChange={(e) => setRowHeight(Number(e.target.value))}
              className="w-32 accent-blue-500"
            />
            <span className="text-sm text-gray-400 w-12 text-right">{rowHeight}px</span>
          </div>
        </div>

        {/* Reopen Sessions */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Reopen Sessions on Startup</div>
            <div className="text-xs text-gray-500 mt-0.5">Automatically restore previous sessions when the app starts</div>
          </div>
          <button
            onClick={() => updateDefaults({ reopenSessions: !config.defaults.reopenSessions })}
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
              config.defaults.reopenSessions ? 'bg-blue-500' : 'bg-white/[0.1]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                config.defaults.reopenSessions ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Default Task View */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Default Task View</div>
            <div className="text-xs text-gray-500 mt-0.5">Choose between list or kanban board for tasks</div>
          </div>
          <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
            {([
              { value: 'list' as TaskViewMode, label: 'List' },
              { value: 'kanban' as TaskViewMode, label: 'Kanban' }
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateDefaults({ taskViewMode: opt.value })}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  (config.defaults.taskViewMode || 'list') === opt.value
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Layout Mode */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Layout Mode</div>
            <div className="text-xs text-gray-500 mt-0.5">Choose between grid or tab layout for sessions</div>
          </div>
          <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
            {([
              { value: 'grid' as const, label: 'Grid' },
              { value: 'tabs' as const, label: 'Tabs' }
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateDefaults({ layoutMode: opt.value })}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  (config.defaults.layoutMode || 'grid') === opt.value
                    ? 'bg-white/[0.1] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Widget */}
        <div className="flex items-center justify-between py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-sm font-medium text-gray-200">Floating Widget</div>
            <div className="text-xs text-gray-500 mt-0.5">Show agent status widget when app is not focused</div>
          </div>
          <button
            onClick={() => {
              const enabled = config.defaults.widgetEnabled === false ? true : false
              updateDefaults({ widgetEnabled: enabled })
              window.api.setWidgetEnabled(enabled)
            }}
            className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
              config.defaults.widgetEnabled !== false ? 'bg-blue-500' : 'bg-white/[0.1]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                config.defaults.widgetEnabled !== false ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notifications section */}
      <h3 className="text-lg font-semibold text-white mt-10 mb-1">Notifications</h3>
      <p className="text-sm text-gray-500 mb-6">Get notified when agents need your attention</p>

      <div className="space-y-1">
        <NotificationToggle
          label="Enable Notifications"
          description="Show OS notifications when agents need attention"
          checked={notifications.enabled}
          onChange={(enabled) => {
            updateNotifications({ enabled })
            if (enabled && Notification.permission === 'default') {
              Notification.requestPermission()
            }
          }}
        />
        <NotificationToggle
          label="Waiting for Input"
          description="Notify when an agent is waiting for your response"
          checked={notifications.onWaiting}
          onChange={(onWaiting) => updateNotifications({ onWaiting })}
          disabled={!notifications.enabled}
        />
        <NotificationToggle
          label="Errors"
          description="Notify when an agent encounters an error"
          checked={notifications.onError}
          onChange={(onError) => updateNotifications({ onError })}
          disabled={!notifications.enabled}
        />
        <NotificationToggle
          label="Terminal Bell"
          description="Notify when an agent explicitly sends a notification signal"
          checked={notifications.onBell}
          onChange={(onBell) => updateNotifications({ onBell })}
          disabled={!notifications.enabled}
        />
      </div>

      {/* Sound section */}
      <h3 className="text-sm font-medium text-gray-200 mt-8 mb-2">Sound</h3>
      <p className="text-sm text-gray-500 mb-6">Play audio tones when agents change status</p>

      <div className="space-y-3">
        <NotificationToggle
          label="Sound Effects"
          description="Play a tone on waiting, error, and bell events (works even when focused)"
          checked={notifications.soundEnabled ?? false}
          onChange={(soundEnabled) => updateNotifications({ soundEnabled })}
          disabled={!notifications.enabled}
        />

        {notifications.soundEnabled && notifications.enabled && (
          <div className="flex items-center gap-3 px-4 py-2">
            <span className="text-xs text-gray-400 shrink-0 w-12">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((notifications.soundVolume ?? 0.5) * 100)}
              onChange={(e) => updateNotifications({ soundVolume: Number(e.target.value) / 100 })}
              className="flex-1 h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-white"
            />
            <span className="text-xs text-gray-500 w-8 text-right">{Math.round((notifications.soundVolume ?? 0.5) * 100)}%</span>
            <button
              onClick={() => playNotificationSound('bell', notifications.soundVolume ?? 0.5)}
              className="px-2 py-1 text-[11px] text-gray-400 hover:text-white bg-white/[0.06]
                         hover:bg-white/[0.1] rounded transition-colors"
            >
              Test
            </button>
          </div>
        )}
      </div>

      {/* About */}
      <h3 className="text-sm font-medium text-gray-200 mt-8 mb-2">About</h3>
      <div className="py-4 border-t border-white/[0.06]">
        <p className="text-sm text-gray-300">VibeGrid v{window.api.getAppVersion()}</p>
        <p className="text-xs text-gray-600 mt-1">&copy; 2026 Javier Canizalez</p>
      </div>
    </div>
  )
}
