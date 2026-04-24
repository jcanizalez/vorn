// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../src/renderer/components/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { useAppStore } from '../src/renderer/stores'
import { FocusedNavHint } from '../src/renderer/components/card/FocusedNavHint'

beforeEach(() => {
  useAppStore.setState({
    visibleTerminalIds: ['a', 'b', 'c']
  })
})

describe('FocusedNavHint', () => {
  it('renders "N / total" with the 1-based index of the current terminal', () => {
    const { container } = render(<FocusedNavHint terminalId="b" />)
    expect(container.textContent).toContain('2')
    expect(container.textContent).toContain('3')
    expect(container.textContent).toMatch(/2\s*\/\s*3/)
  })

  it('returns nothing when fewer than 2 sessions are visible', () => {
    useAppStore.setState({ visibleTerminalIds: ['a'] })
    const { container } = render(<FocusedNavHint terminalId="a" />)
    expect(container.firstChild).toBeNull()
  })

  it('returns nothing when the current terminal is not in the visible list', () => {
    const { container } = render(<FocusedNavHint terminalId="gone" />)
    expect(container.firstChild).toBeNull()
  })

  it('Next button focuses the following terminal', () => {
    const setFocusedTerminal = vi.fn()
    useAppStore.setState({ setFocusedTerminal })
    render(<FocusedNavHint terminalId="a" />)
    fireEvent.click(screen.getByLabelText('Next session'))
    expect(setFocusedTerminal).toHaveBeenCalledWith('b')
  })

  it('Next button wraps around from the last terminal to the first', () => {
    const setFocusedTerminal = vi.fn()
    useAppStore.setState({ setFocusedTerminal })
    render(<FocusedNavHint terminalId="c" />)
    fireEvent.click(screen.getByLabelText('Next session'))
    expect(setFocusedTerminal).toHaveBeenCalledWith('a')
  })

  it('Previous button focuses the preceding terminal', () => {
    const setFocusedTerminal = vi.fn()
    useAppStore.setState({ setFocusedTerminal })
    render(<FocusedNavHint terminalId="c" />)
    fireEvent.click(screen.getByLabelText('Previous session'))
    expect(setFocusedTerminal).toHaveBeenCalledWith('b')
  })

  it('Previous button wraps from the first terminal to the last', () => {
    const setFocusedTerminal = vi.fn()
    useAppStore.setState({ setFocusedTerminal })
    render(<FocusedNavHint terminalId="a" />)
    fireEvent.click(screen.getByLabelText('Previous session'))
    expect(setFocusedTerminal).toHaveBeenCalledWith('c')
  })
})
