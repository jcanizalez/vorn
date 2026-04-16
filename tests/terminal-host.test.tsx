// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const hoisted = vi.hoisted(() => ({
  setHostRoot: vi.fn(),
  syncTerminalOverlay: vi.fn(),
  getRegisteredTerminalIds: vi.fn().mockReturnValue([]),
  onRegistryChange: vi.fn().mockReturnValue(() => {}),
  TERMINAL_ID_ATTR: 'data-terminal-id'
}))

vi.mock('../src/renderer/lib/terminal-registry', () => hoisted)

vi.mock('../src/renderer/components/TerminalContextMenu', () => ({
  TerminalContextMenu: ({ terminalId, onClose }: { terminalId: string; onClose: () => void }) => (
    <div data-testid="context-menu" data-terminal-id={terminalId} onClick={onClose} />
  )
}))

import { TerminalHost } from '../src/renderer/components/TerminalHost'

describe('TerminalHost', () => {
  let rafCallbacks: Array<(time: number) => void> = []
  let nextRafId = 1

  beforeEach(() => {
    rafCallbacks = []
    nextRafId = 1
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb)
        return nextRafId++
      })
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn(() => {})
    )
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('sets the host root on mount and clears it on unmount', () => {
    const { unmount } = render(<TerminalHost />)
    expect(hoisted.setHostRoot).toHaveBeenCalledWith(expect.any(HTMLElement))
    unmount()
    expect(hoisted.setHostRoot).toHaveBeenLastCalledWith(null)
  })

  it('renders a fixed-position root div with pointer-events disabled', () => {
    const { container } = render(<TerminalHost />)
    const root = container.querySelector('div[aria-hidden="true"]') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.className).toContain('fixed')
    expect(root.className).toContain('pointer-events-none')
  })

  it('subscribes to registry changes and re-syncs all terminals on fire', () => {
    hoisted.getRegisteredTerminalIds.mockReturnValue(['t1', 't2'])
    let captured: (() => void) | null = null
    hoisted.onRegistryChange.mockImplementation((cb: () => void) => {
      captured = cb
      return () => {}
    })
    render(<TerminalHost />)
    expect(captured).not.toBeNull()
    hoisted.syncTerminalOverlay.mockClear()
    captured!()
    expect(hoisted.syncTerminalOverlay).toHaveBeenCalledWith('t1')
    expect(hoisted.syncTerminalOverlay).toHaveBeenCalledWith('t2')
  })

  it('starts a rAF loop that calls syncTerminalOverlay for each registered id', () => {
    hoisted.getRegisteredTerminalIds.mockReturnValue(['alpha'])
    render(<TerminalHost />)
    expect(rafCallbacks.length).toBeGreaterThan(0)
    hoisted.syncTerminalOverlay.mockClear()
    rafCallbacks[0](0)
    expect(hoisted.syncTerminalOverlay).toHaveBeenCalledWith('alpha')
  })

  it('opens context menu on right-click over a wrapper with data-terminal-id', () => {
    const { container, getByTestId } = render(<TerminalHost />)
    const root = container.querySelector('div[aria-hidden="true"]') as HTMLElement
    const wrapper = document.createElement('div')
    wrapper.dataset.terminalId = 'my-term'
    root.appendChild(wrapper)
    fireEvent.contextMenu(wrapper, { clientX: 100, clientY: 200 })
    const menu = getByTestId('context-menu')
    expect(menu).toHaveAttribute('data-terminal-id', 'my-term')
  })

  it('ignores right-clicks on elements without data-terminal-id', () => {
    const { container, queryByTestId } = render(<TerminalHost />)
    const root = container.querySelector('div[aria-hidden="true"]') as HTMLElement
    const stray = document.createElement('div')
    root.appendChild(stray)
    fireEvent.contextMenu(stray, { clientX: 0, clientY: 0 })
    expect(queryByTestId('context-menu')).toBeNull()
  })
})
