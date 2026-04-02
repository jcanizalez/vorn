import { useShallow } from 'zustand/react/shallow'
import { HeadlessSession } from '../../shared/types'
import { HeadlessPill } from './HeadlessPill'
import { MinimizedPill } from './MinimizedPill'
import { useAppStore } from '../stores'
import { ChevronRight } from 'lucide-react'

interface Props {
  headlessSessions: HeadlessSession[]
  minimizedIds: string[]
  variant: 'grid' | 'tabs'
  hasItemsBelow?: boolean
}

export function BackgroundTray({ headlessSessions, minimizedIds, variant, hasItemsBelow }: Props) {
  const { collapsed, toggle } = useAppStore(
    useShallow((s) => ({
      collapsed: s.backgroundTrayCollapsed,
      toggle: s.toggleBackgroundTray
    }))
  )

  const headlessCount = headlessSessions.length
  const minimizedCount = minimizedIds.length
  const totalCount = headlessCount + minimizedCount

  if (totalCount === 0) return null

  const runningCount = headlessSessions.filter((s) => s.status === 'running').length
  const hasBoth = headlessCount > 0 && minimizedCount > 0

  const isGrid = variant === 'grid'

  return (
    <div className={isGrid ? 'mb-4' : 'shrink-0 px-3 py-2 border-b border-white/[0.06]'}>
      {/* Header row */}
      <button
        type="button"
        className={`flex items-center gap-1.5 w-full text-left cursor-pointer group ${isGrid ? 'px-1 mb-2' : 'mb-1.5'}`}
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label="Toggle background tray"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`text-gray-500 transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
        />
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
          Background
        </span>

        {/* Count badges */}
        <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
          {headlessCount > 0 && (
            <span>
              {runningCount > 0 ? `${runningCount} running` : `${headlessCount} headless`}
            </span>
          )}
          {hasBoth && <span>&middot;</span>}
          {minimizedCount > 0 && <span>{minimizedCount} minimized</span>}
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[132px] opacity-100'
        }`}
      >
        <div className={`flex max-h-[120px] overflow-y-auto ${hasBoth ? 'gap-4' : ''}`}>
          {/* Headless group */}
          {headlessCount > 0 && (
            <div className={hasBoth ? 'flex-1 min-w-0' : 'w-full'}>
              {hasBoth && (
                <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider mb-1 block">
                  headless
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {headlessSessions.map((session) => (
                  <HeadlessPill key={session.id} session={session} />
                ))}
              </div>
            </div>
          )}

          {/* Vertical divider */}
          {hasBoth && <div className="w-px bg-white/[0.08] self-stretch" />}

          {/* Minimized group */}
          {minimizedCount > 0 && (
            <div className={hasBoth ? 'flex-1 min-w-0' : 'w-full'}>
              {hasBoth && (
                <span className="text-[9px] font-medium text-gray-600 uppercase tracking-wider mb-1 block">
                  minimized
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {minimizedIds.map((id) => (
                  <MinimizedPill key={id} terminalId={id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom divider */}
      {hasItemsBelow && !collapsed && <div className="h-px bg-white/[0.06] mt-4" />}
    </div>
  )
}
