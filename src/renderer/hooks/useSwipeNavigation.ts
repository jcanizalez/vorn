import { useRef, useCallback } from 'react'

const MIN_SWIPE_DISTANCE = 50
const MAX_SWIPE_TIME = 300 // ms — must be a quick flick, not a drag

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

/**
 * Detects horizontal swipe gestures on a container.
 * Returns touch event handlers to attach to the container element.
 *
 * - Swipe right → onPrev (previous terminal)
 * - Swipe left  → onNext (next terminal)
 * - Minimum 50px horizontal travel, within 300ms
 * - Ignores vertical-dominant gestures (scrolling)
 */
export function useSwipeNavigation(onPrev: () => void, onNext: () => void): SwipeHandlers {
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() }
  }, [])

  const onTouchMove = useCallback((_e: React.TouchEvent) => {
    // Could add visual drag feedback here in the future
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y
      const dt = Date.now() - touchStart.current.t

      touchStart.current = null

      // Must be horizontal-dominant and fast enough
      if (Math.abs(dx) < MIN_SWIPE_DISTANCE) return
      if (Math.abs(dy) > Math.abs(dx)) return // vertical scroll, ignore
      if (dt > MAX_SWIPE_TIME) return

      if (dx > 0) {
        onPrev()
      } else {
        onNext()
      }
    },
    [onPrev, onNext]
  )

  return { onTouchStart, onTouchMove, onTouchEnd }
}
