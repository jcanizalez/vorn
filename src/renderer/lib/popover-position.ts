export interface AnchorRect {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PopoverSize {
  width: number
  height: number
}

export interface ViewportSize {
  width: number
  height: number
}

export interface PopoverPosition {
  top: number
  left: number
  placement: 'top' | 'bottom'
}

const VIEWPORT_MARGIN = 8
const POPOVER_GAP = 6

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function calculatePopoverPosition(
  anchor: AnchorRect,
  popover: PopoverSize,
  viewport: ViewportSize
): PopoverPosition {
  const halfWidth = popover.width / 2
  const centerX = anchor.left + anchor.width / 2
  const minLeft = VIEWPORT_MARGIN + halfWidth
  const maxLeft = viewport.width - VIEWPORT_MARGIN - halfWidth
  const left = minLeft > maxLeft ? viewport.width / 2 : clamp(centerX, minLeft, maxLeft)

  const bottomTop = anchor.bottom + POPOVER_GAP
  const topTop = anchor.top - popover.height - POPOVER_GAP

  if (bottomTop + popover.height + VIEWPORT_MARGIN <= viewport.height) {
    return { top: bottomTop, left, placement: 'bottom' }
  }

  if (topTop >= VIEWPORT_MARGIN) {
    return { top: topTop, left, placement: 'top' }
  }

  return {
    top: clamp(bottomTop, VIEWPORT_MARGIN, viewport.height - popover.height - VIEWPORT_MARGIN),
    left,
    placement: 'bottom'
  }
}
