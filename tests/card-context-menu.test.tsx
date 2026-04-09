// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock dependencies before imports
const mockCreateTerminal = vi.fn()
const mockListBranches = vi.fn()
const mockListWorktrees = vi.fn()

Object.defineProperty(window, 'api', {
  value: {
    createTerminal: (...args: unknown[]) => mockCreateTerminal(...args),
    listBranches: (...args: unknown[]) => mockListBranches(...args),
    listWorktrees: (...args: unknown[]) => mockListWorktrees(...args),
    killTerminal: vi.fn(),
    saveConfig: vi.fn(),
    notifyWidgetStatus: vi.fn(),
    isWorktreeDirty: vi.fn().mockResolvedValue(false),
    getGitDiffStat: vi.fn().mockResolvedValue(null)
  },
  writable: true
})

vi.mock('../src/renderer/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/renderer/lib/terminal-close', () => ({
  closeTerminalSession: vi.fn()
}))

vi.mock('../src/renderer/hooks/useIsMobile', () => ({
  useIsMobile: () => false
}))

import { useAppStore } from '../src/renderer/stores'
import { CardContextMenu } from '../src/renderer/components/CardContextMenu'

const mockTerminal = {
  id: 'term-1',
  session: {
    id: 'term-1',
    agentType: 'claude' as const,
    projectName: 'Vorn',
    projectPath: '/tmp/vorn',
    isWorktree: false,
    branch: 'main'
  },
  status: 'idle' as const,
  lastOutputTimestamp: Date.now()
}

const mockWorktreeTerminal = {
  id: 'term-2',
  session: {
    id: 'term-2',
    agentType: 'claude' as const,
    projectName: 'Vorn',
    projectPath: '/tmp/vorn',
    isWorktree: true,
    branch: 'feature-auth',
    worktreePath: '/tmp/.vorn-worktrees/vorn/feature-auth'
  },
  status: 'running' as const,
  lastOutputTimestamp: Date.now()
}

const mockConfig = {
  projects: [
    {
      name: 'Vorn',
      path: '/tmp/vorn',
      icon: 'Rocket',
      iconColor: '#ff0000',
      preferredAgents: ['claude' as const]
    }
  ],
  workflows: [],
  defaults: { defaultAgent: 'claude' as const, rowHeight: 208 },
  remoteHosts: [],
  workspaces: []
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListWorktrees.mockResolvedValue([])
  mockListBranches.mockResolvedValue({ current: 'main', branches: [] })
  const terminals = new Map()
  terminals.set('term-1', mockTerminal)
  terminals.set('term-2', mockWorktreeTerminal)

  useAppStore.setState({
    terminals,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: mockConfig as any,
    focusedTerminalId: null,
    worktreeCache: new Map(),
    activeProject: 'Vorn',
    activeWorktreePath: null
  })
})

describe('CardContextMenu', () => {
  it('renders smart quick-launch with project name', () => {
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session in Vorn')).toBeInTheDocument()
  })

  it('renders worktree-aware quick-launch label when terminal is in a worktree', () => {
    render(<CardContextMenu terminalId="term-2" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session in Vorn on feature-auth')).toBeInTheDocument()
  })

  it('renders worktree submenu item with chevron', () => {
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session in Vorn...')).toBeInTheDocument()
  })

  it('does not render old "New session in worktree" flat label', () => {
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.queryByText('New session in worktree')).not.toBeInTheDocument()
    expect(screen.queryByText('New session (same project)')).not.toBeInTheDocument()
  })

  it('shows submenu with worktrees on hover', () => {
    const worktrees = [{ path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false }]
    const cache = new Map()
    cache.set('/tmp/vorn', worktrees)
    useAppStore.setState({ worktreeCache: cache })

    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const submenuTrigger = screen.getByText('New session in Vorn...')
    fireEvent.mouseEnter(submenuTrigger.closest('button')!)

    expect(screen.getByText('feat-a')).toBeInTheDocument()
    expect(screen.getByText('New worktree')).toBeInTheDocument()
  })

  it('shows session count for worktrees with active sessions', () => {
    const worktrees = [
      {
        path: '/tmp/.vorn-worktrees/vorn/feature-auth',
        branch: 'feature-auth',
        isMain: false
      }
    ]
    const cache = new Map()
    cache.set('/tmp/vorn', worktrees)
    useAppStore.setState({ worktreeCache: cache })

    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const submenuTrigger = screen.getByText('New session in Vorn...')
    fireEvent.mouseEnter(submenuTrigger.closest('button')!)

    // term-2 has worktreePath matching this worktree
    expect(screen.getByText('1 session')).toBeInTheDocument()
  })

  it('quick-launch creates terminal in same project', async () => {
    mockCreateTerminal.mockResolvedValue({
      id: 'new-term',
      session: {
        id: 'new-term',
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn'
      },
      status: 'idle',
      lastOutputTimestamp: Date.now()
    })

    const onClose = vi.fn()
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('New session in Vorn'))

    expect(onClose).toHaveBeenCalled()
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn'
      })
    )
  })

  it('quick-launch for worktree terminal creates in same worktree', async () => {
    mockCreateTerminal.mockResolvedValue({
      id: 'new-term',
      session: {
        id: 'new-term',
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn'
      },
      status: 'idle',
      lastOutputTimestamp: Date.now()
    })

    const onClose = vi.fn()
    render(<CardContextMenu terminalId="term-2" position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('New session in Vorn on feature-auth'))

    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn',
        branch: 'feature-auth',
        existingWorktreePath: '/tmp/.vorn-worktrees/vorn/feature-auth'
      })
    )
  })

  it('still renders Expand, Rename, Pin, and Close items', () => {
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('Expand')).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Pin')).toBeInTheDocument()
    expect(screen.getByText('Close session')).toBeInTheDocument()
  })

  it('calls onClose on click outside', () => {
    const onClose = vi.fn()
    render(
      <div>
        <div data-testid="outside">outside</div>
        <CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={onClose} />
      </div>
    )
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('returns null when terminal not found', () => {
    const { container } = render(
      <CardContextMenu terminalId="nonexistent" position={{ x: 100, y: 100 }} onClose={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })
})
