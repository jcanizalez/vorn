// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock dependencies before imports
const mockCreateTerminal = vi.fn()
const mockCreateShellTerminal = vi.fn()
const mockListBranches = vi.fn()
const mockListWorktrees = vi.fn()

Object.defineProperty(window, 'api', {
  value: {
    createTerminal: (...args: unknown[]) => mockCreateTerminal(...args),
    createShellTerminal: (...args: unknown[]) => mockCreateShellTerminal(...args),
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

import { useAppStore } from '../src/renderer/stores'
import { GridContextMenu } from '../src/renderer/components/GridContextMenu'

const mockConfig = {
  projects: [
    {
      name: 'Vorn',
      path: '/tmp/vorn',
      icon: 'Rocket',
      iconColor: '#ff0000',
      preferredAgents: ['claude' as const]
    },
    {
      name: 'OtherApp',
      path: '/tmp/otherapp',
      icon: 'Code',
      iconColor: '#00ff00',
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

  useAppStore.setState({
    terminals: new Map(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: mockConfig as any,
    activeProject: 'Vorn',
    activeWorktreePath: null,
    activeWorkspace: 'personal',
    worktreeCache: new Map()
  })
})

describe('GridContextMenu', () => {
  it('renders smart quick-launch with active project name', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session in Vorn')).toBeInTheDocument()
  })

  it('renders every workspace project as a top-level item', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    // Active project still appears in Projects section in addition to the quick-launch row.
    expect(screen.getByText('Vorn')).toBeInTheDocument()
    expect(screen.getByText('OtherApp')).toBeInTheDocument()
  })

  it('renders "New session..." for full dialog', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session...')).toBeInTheDocument()
  })

  it('does not show old flat "New session in worktree" label', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.queryByText('New session in worktree')).not.toBeInTheDocument()
  })

  it('shows projects list in All Projects view', () => {
    useAppStore.setState({ activeProject: null })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    // Quick launch should use first project from resolveActiveProject
    expect(screen.getByText(/New session in Vorn/)).toBeInTheDocument()

    // Projects are now top-level items, no "New session from..." wrapper
    expect(screen.queryByText('New session from...')).not.toBeInTheDocument()
    expect(screen.getByText('Vorn')).toBeInTheDocument()
    expect(screen.getByText('OtherApp')).toBeInTheDocument()
  })

  it('shows worktree submenu on hover over project item', () => {
    const cache = new Map()
    cache.set('/tmp/vorn', [
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false, name: 'feat-a' },
      { path: '/tmp/wt/feat-b', branch: 'feat-b', isMain: false, name: 'feat-b' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const vornItem = screen.getByText('Vorn')
    fireEvent.mouseEnter(vornItem.closest('button')!)

    expect(screen.getByText('feat-a')).toBeInTheDocument()
    expect(screen.getByText('feat-b')).toBeInTheDocument()
    expect(screen.getByText('New worktree')).toBeInTheDocument()
  })

  it('shows worktree submenu on hover over non-active project', () => {
    const cache = new Map()
    cache.set('/tmp/otherapp', [
      { path: '/tmp/wt/experiment', branch: 'experiment', isMain: false, name: 'experiment' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    // The Projects section still lists OtherApp when we're inside Vorn.
    const otherItem = screen.getByText('OtherApp')
    fireEvent.mouseEnter(otherItem.closest('button')!)

    expect(screen.getByText('experiment')).toBeInTheDocument()
  })

  it('shows the main branch as a first entry in the worktree submenu', () => {
    const cache = new Map()
    cache.set('/tmp/vorn', [
      { path: '/tmp/vorn', branch: 'main', isMain: true, name: 'vorn' },
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false, name: 'feat-a' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    fireEvent.mouseEnter(screen.getByText('Vorn').closest('button')!)

    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('feat-a')).toBeInTheDocument()
    expect(screen.getByText('New worktree')).toBeInTheDocument()
  })

  it('clicking the main branch entry creates a terminal pinned to the main worktree', async () => {
    const cache = new Map()
    cache.set('/tmp/vorn', [
      { path: '/tmp/vorn', branch: 'main', isMain: true, name: 'vorn' },
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false, name: 'feat-a' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    mockCreateTerminal.mockResolvedValue({
      id: 'main-term',
      session: {
        id: 'main-term',
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn',
        branch: 'main',
        worktreePath: '/tmp/vorn'
      },
      status: 'idle',
      lastOutputTimestamp: Date.now()
    })

    const onClose = vi.fn()
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.mouseEnter(screen.getByText('Vorn').closest('button')!)
    fireEvent.click(screen.getByText('main'))

    expect(onClose).toHaveBeenCalled()
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn',
        branch: 'main',
        existingWorktreePath: '/tmp/vorn'
      })
    )
  })

  it('clicking a worktree in the submenu creates terminal on that worktree', async () => {
    const cache = new Map()
    cache.set('/tmp/vorn', [
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false, name: 'feat-a' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    mockCreateTerminal.mockResolvedValue({
      id: 'wt-term',
      session: {
        id: 'wt-term',
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn',
        branch: 'feat-a',
        worktreePath: '/tmp/wt/feat-a'
      },
      status: 'idle',
      lastOutputTimestamp: Date.now()
    })

    const onClose = vi.fn()
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.mouseEnter(screen.getByText('Vorn').closest('button')!)
    fireEvent.click(screen.getByText('feat-a'))

    expect(onClose).toHaveBeenCalled()
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn',
        branch: 'feat-a',
        existingWorktreePath: '/tmp/wt/feat-a'
      })
    )
  })

  it('quick-launch creates terminal with active project', async () => {
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
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

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

  it('clicking a project item creates a plain session in that project', async () => {
    mockCreateTerminal.mockResolvedValue({
      id: 'plain-term',
      session: {
        id: 'plain-term',
        agentType: 'claude',
        projectName: 'OtherApp',
        projectPath: '/tmp/otherapp'
      },
      status: 'idle',
      lastOutputTimestamp: Date.now()
    })

    const onClose = vi.fn()
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('OtherApp'))

    expect(onClose).toHaveBeenCalled()
    const call = mockCreateTerminal.mock.calls[0][0]
    expect(call.projectName).toBe('OtherApp')
    expect(call.branch).toBeUndefined()
    expect(call.existingWorktreePath).toBeUndefined()
  })

  it('non-git project hover does not render a worktree submenu', () => {
    // No worktreeCache entry for OtherApp → buildWorktreeSubmenu returns null.
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const otherItem = screen.getByText('OtherApp')
    fireEvent.mouseEnter(otherItem.closest('button')!)

    // "New worktree" would indicate a git-flavored submenu opened; it should not.
    expect(screen.queryByText('New worktree')).not.toBeInTheDocument()
  })

  it('falls back to opening dialog when no project is resolved', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ config: { ...mockConfig, projects: [] } as any, activeProject: null })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    // Should show generic "New session" without project name
    expect(screen.getByText('New session')).toBeInTheDocument()
  })

  it('calls onClose on click outside', () => {
    const onClose = vi.fn()
    render(
      <div>
        <div data-testid="outside">outside</div>
        <GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />
      </div>
    )
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('New terminal item (unified sessions panel)', () => {
    it('is rendered at the top level', () => {
      render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
      expect(screen.getByText('New terminal')).toBeInTheDocument()
    })

    it('clicking it creates a shell via createShellTerminal in the active project cwd', async () => {
      const shellSession = {
        id: 'sh-1',
        agentType: 'shell' as const,
        projectName: 'vorn',
        projectPath: '/tmp/vorn',
        status: 'running' as const,
        createdAt: Date.now(),
        pid: 4321,
        displayName: 'Shell 1',
        shellCwd: '/tmp/vorn'
      }
      mockCreateShellTerminal.mockResolvedValue(shellSession)

      const addTerminal = vi.fn()
      const setActiveTabId = vi.fn()
      useAppStore.setState({ addTerminal, setActiveTabId })

      const onClose = vi.fn()
      render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

      fireEvent.click(screen.getByText('New terminal'))
      // Wait for the async onClick to finish
      await new Promise((r) => setTimeout(r, 0))

      expect(onClose).toHaveBeenCalled()
      expect(mockCreateShellTerminal).toHaveBeenCalledWith('/tmp/vorn')
      expect(addTerminal).toHaveBeenCalledWith(shellSession)
      expect(setActiveTabId).toHaveBeenCalledWith('sh-1')
    })

    it('falls back to undefined cwd when there is no active project', async () => {
      useAppStore.setState({
        activeProject: null,
        config: { ...mockConfig, projects: [] } as unknown as typeof mockConfig
      })
      mockCreateShellTerminal.mockResolvedValue({
        id: 'sh-2',
        agentType: 'shell' as const,
        projectName: 'shell',
        projectPath: '/home/user',
        status: 'running' as const,
        createdAt: Date.now(),
        pid: 1,
        displayName: 'Shell 1'
      })

      render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
      fireEvent.click(screen.getByText('New terminal'))
      await new Promise((r) => setTimeout(r, 0))

      expect(mockCreateShellTerminal).toHaveBeenCalledWith(undefined)
    })
  })
})
