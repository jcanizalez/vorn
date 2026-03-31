// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useAppStore } from '../src/renderer/stores'
import { SessionItem } from '../src/renderer/components/project-sidebar/SessionItem'
import type { SidebarSessionInfo } from '../src/renderer/components/project-sidebar/types'

const session: SidebarSessionInfo = {
  id: 'sess-1',
  name: 'My Session',
  status: 'running',
  agentType: 'claude',
  branch: 'main',
  isWorktree: false
}

const initialState = useAppStore.getState()

describe('SessionItem', () => {
  beforeEach(() => {
    useAppStore.setState({ focusedTerminalId: null })
  })

  afterEach(() => {
    useAppStore.setState(initialState)
  })

  it('renders session name', () => {
    render(<SessionItem session={session} />)
    expect(screen.getByText('My Session')).toBeInTheDocument()
  })

  it('renders branch when showBranch is true (default)', () => {
    render(<SessionItem session={session} />)
    expect(screen.getByText('main')).toBeInTheDocument()
  })

  it('hides branch when showBranch is false', () => {
    render(<SessionItem session={session} showBranch={false} />)
    expect(screen.queryByText('main')).not.toBeInTheDocument()
  })

  it('renders status dot with correct class', () => {
    const { container } = render(<SessionItem session={session} />)
    const dot = container.querySelector('.bg-green-400')
    expect(dot).toBeInTheDocument()
  })

  it('renders agent icon', () => {
    const { container } = render(<SessionItem session={session} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('calls setFocusedTerminal on click', () => {
    const setFocused = vi.fn()
    useAppStore.setState({ setFocusedTerminal: setFocused })
    render(<SessionItem session={session} />)
    fireEvent.click(screen.getByText('My Session'))
    expect(setFocused).toHaveBeenCalledWith('sess-1')
  })

  it('applies focused style when session is focused', () => {
    useAppStore.setState({ focusedTerminalId: 'sess-1' })
    const { container } = render(<SessionItem session={session} />)
    const button = container.querySelector('button')
    expect(button?.className).toContain('bg-white/[0.08]')
  })

  it('applies unfocused style when session is not focused', () => {
    useAppStore.setState({ focusedTerminalId: 'other' })
    const { container } = render(<SessionItem session={session} />)
    const button = container.querySelector('button')
    expect(button?.className).toContain('text-gray-400')
  })

  it('renders without branch when session has no branch', () => {
    const noBranch: SidebarSessionInfo = { ...session, branch: undefined }
    render(<SessionItem session={noBranch} />)
    expect(screen.queryByText('main')).not.toBeInTheDocument()
  })

  it.each([
    ['running', 'bg-green-400'],
    ['waiting', 'bg-yellow-400'],
    ['idle', 'bg-gray-500'],
    ['error', 'bg-red-500']
  ] as const)('renders "%s" status as badge dot', (status, colorClass) => {
    const s: SidebarSessionInfo = { ...session, status }
    const { container } = render(<SessionItem session={s} />)
    const badge = container.querySelector(`.${colorClass.replace('/', '\\/')}`)
    expect(badge).toBeInTheDocument()
  })

  it('renders close button', () => {
    const { container } = render(<SessionItem session={session} />)
    const closeBtn = container.querySelector('button[type="button"]')
    expect(closeBtn).toBeInTheDocument()
  })
})
