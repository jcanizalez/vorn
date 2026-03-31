// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('SessionItem', () => {
  beforeEach(() => {
    useAppStore.setState({ focusedTerminalId: null })
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
    const dot = container.querySelector('.status-dot.status-running')
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

  it('renders status label text', () => {
    render(<SessionItem session={session} />)
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it.each([
    ['running', 'Running'],
    ['waiting', 'Waiting'],
    ['idle', 'Idle'],
    ['error', 'Error']
  ] as const)('renders "%s" status as "%s"', (status, label) => {
    const s: SidebarSessionInfo = { ...session, status }
    render(<SessionItem session={s} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
