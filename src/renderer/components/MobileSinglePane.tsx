import { useCallback } from 'react'
import { useAppStore } from '../stores'
import { AgentCard } from './AgentCard'
import { PromptLauncher } from './PromptLauncher'
import { useVisibleTerminals } from '../hooks/useVisibleTerminals'
import { useSwipeNavigation } from '../hooks/useSwipeNavigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Single-pane mobile layout: shows one terminal at a time with swipe navigation.
 * Replaces GridView on mobile for a native app-like experience.
 *
 * - Swipe left/right to switch terminals
 * - Dot indicators at top show position
 * - Arrow buttons for accessibility (non-swipe users)
 * - Falls back to PromptLauncher when no sessions exist
 */
export function MobileSinglePane() {
  const orderedIds = useVisibleTerminals()
  const selectedId = useAppStore((s) => s.selectedTerminalId)
  const setSelected = useAppStore((s) => s.setSelectedTerminal)

  // Use store selection as the source of truth for which terminal is shown.
  // Swipe/arrows/dots all go through setSelected → store → re-render.
  // Derive index from selectedId; fall back to 0 if not found.
  const selectedIndex =
    selectedId && orderedIds.length > 0 ? Math.max(0, orderedIds.indexOf(selectedId)) : 0

  // Clamp: if selectedId isn't in the filtered list, show first terminal
  const activeIndex = Math.min(selectedIndex, Math.max(0, orderedIds.length - 1))

  const navigateTo = useCallback(
    (index: number) => {
      const id = orderedIds[index]
      if (id) setSelected(id)
    },
    [orderedIds, setSelected]
  )

  const goNext = useCallback(() => {
    const next = Math.min(activeIndex + 1, orderedIds.length - 1)
    navigateTo(next)
  }, [activeIndex, orderedIds.length, navigateTo])

  const goPrev = useCallback(() => {
    const prev = Math.max(activeIndex - 1, 0)
    navigateTo(prev)
  }, [activeIndex, navigateTo])

  const swipeHandlers = useSwipeNavigation(goPrev, goNext)

  // No terminals — show launcher
  if (orderedIds.length === 0) {
    return (
      <div className="h-full overflow-auto p-4">
        <PromptLauncher mode="inline" />
      </div>
    )
  }

  const currentId = orderedIds[activeIndex]
  const total = orderedIds.length

  return (
    <div className="h-full flex flex-col" {...swipeHandlers}>
      {/* Indicator bar: dots + arrows */}
      {total > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-3 py-1.5 px-4">
          <button
            onClick={goPrev}
            disabled={activeIndex === 0}
            className="p-1 text-gray-500 active:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-1.5">
            {orderedIds.map((id, i) => (
              <button
                key={id}
                onClick={() => navigateTo(i)}
                className={`rounded-full transition-all ${
                  i === activeIndex
                    ? 'w-2 h-2 bg-cyan-400'
                    : 'w-1.5 h-1.5 bg-gray-600 active:bg-gray-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={goNext}
            disabled={activeIndex === total - 1}
            className="p-1 text-gray-500 active:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Single terminal card — full height */}
      <div className="flex-1 min-h-0 px-2 pb-2">
        <AgentCard key={currentId} terminalId={currentId} />
      </div>
    </div>
  )
}
