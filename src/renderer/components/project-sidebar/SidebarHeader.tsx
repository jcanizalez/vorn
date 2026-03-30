import { isElectron } from '../../lib/platform'
import { useAppStore } from '../../stores'
import { WorkspaceSwitcher } from '../WorkspaceSwitcher'
import { PanelLeft } from 'lucide-react'

export function SidebarHeader({ isCollapsed }: { isCollapsed: boolean }) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  return (
    <div
      className={`titlebar-drag h-[52px] pr-3 flex items-center
                    border-b border-white/[0.06] shrink-0 ${isElectron ? 'pl-[78px]' : 'pl-3'}`}
    >
      {!isCollapsed && (
        <div className="flex-1 titlebar-no-drag min-w-0">
          <WorkspaceSwitcher />
        </div>
      )}
      {!isCollapsed && (
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-white titlebar-no-drag p-1 rounded-md transition-colors shrink-0"
        >
          <PanelLeft size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
