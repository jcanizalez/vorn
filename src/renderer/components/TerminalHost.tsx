import { useEffect, useRef, useState } from 'react'
import {
  setHostRoot,
  syncTerminalOverlay,
  getRegisteredTerminalIds,
  onRegistryChange,
  TERMINAL_ID_ATTR
} from '../lib/terminal-registry'
import { TerminalContextMenu } from './TerminalContextMenu'

interface CtxMenuState {
  terminalId: string
  x: number
  y: number
}

/**
 * Per-frame rAF is used (not ResizeObserver) because Framer Motion springs
 * animate `transform`, which does not trigger RO. The loop is cheap:
 * syncTerminalOverlay early-returns when the slot rect is unchanged.
 */
export function TerminalHost() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    setHostRoot(el)

    const handleContextMenu = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null
      const wrapper = target?.closest(`[${TERMINAL_ID_ATTR}]`) as HTMLElement | null
      if (!wrapper) return
      const terminalId = wrapper.getAttribute(TERMINAL_ID_ATTR)
      if (!terminalId) return
      e.preventDefault()
      setCtxMenu({ terminalId, x: e.clientX, y: e.clientY })
    }
    el.addEventListener('contextmenu', handleContextMenu)

    let rafId = requestAnimationFrame(function tick(): void {
      const ids = getRegisteredTerminalIds()
      for (const id of ids) syncTerminalOverlay(id)
      rafId = requestAnimationFrame(tick)
    })

    const unsubscribe = onRegistryChange(() => {
      for (const id of getRegisteredTerminalIds()) syncTerminalOverlay(id)
    })

    return () => {
      el.removeEventListener('contextmenu', handleContextMenu)
      cancelAnimationFrame(rafId)
      unsubscribe()
      setHostRoot(null)
    }
  }, [])

  return (
    <>
      {/* Sits above FocusedTerminal's mobile panel (z-40) and below popovers
          (z-50+) so every popover renders on top of the terminal overlay.
          Pointer events disabled on the root — wrappers opt back in when active. */}
      <div ref={rootRef} className="fixed inset-0 pointer-events-none z-[45]" />
      {ctxMenu && (
        <TerminalContextMenu
          terminalId={ctxMenu.terminalId}
          position={{ x: ctxMenu.x, y: ctxMenu.y }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}
