import { useAppStore } from '../../stores'
import { KbdHint } from '../KbdHint'
import { CircleHelp, Settings } from 'lucide-react'

export function SidebarFooter({
  isCollapsed,
  closeSidebarOnMobile
}: {
  isCollapsed: boolean
  closeSidebarOnMobile: () => void
}) {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen)

  const iconSize = isCollapsed ? 22 : 14

  return (
    <div className={`p-3 border-t border-white/[0.06] space-y-0.5 ${isCollapsed ? 'p-1.5' : ''}`}>
      <button
        onClick={() => setOnboardingOpen(true)}
        className={`w-full px-2.5 py-1.5 text-[13px] text-gray-400 hover:text-white
                   hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2
                   ${isCollapsed ? 'justify-center px-0' : ''}`}
        title={isCollapsed ? 'Welcome Guide' : undefined}
      >
        <CircleHelp size={iconSize} strokeWidth={1.5} className="shrink-0" />
        {!isCollapsed && 'Welcome Guide'}
      </button>
      <button
        onClick={() => {
          setSettingsOpen(true)
          closeSidebarOnMobile()
        }}
        className={`w-full px-2.5 py-1.5 text-[13px] text-gray-300 hover:text-white
                   hover:bg-white/[0.04] rounded-md transition-colors text-left flex items-center gap-2
                   ${isCollapsed ? 'justify-center px-0' : ''}`}
        title={isCollapsed ? 'Settings' : undefined}
      >
        <Settings size={iconSize} strokeWidth={1.5} className="shrink-0" />
        {!isCollapsed && (
          <>
            Settings
            <KbdHint shortcutId="settings" className="ml-auto" />
          </>
        )}
      </button>
    </div>
  )
}
