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
  it('renders New session and New terminal rows', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session')).toBeInTheDocument()
    expect(screen.getByText('New terminal')).toBeInTheDocument()
  })

  it('renders every workspace project as a top-level item', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('Vorn')).toBeInTheDocument()
    expect(screen.getByText('OtherApp')).toBeInTheDocument()
  })

  it('renders "New session..." for full dialog', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session...')).toBeInTheDocument()
  })

  it('New session creates agent session in active project', async () => {
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
    fireEvent.click(screen.getByText('New session'))

    expect(onClose).toHaveBeenCalled()
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'claude',
        projectName: 'Vorn',
        projectPath: '/tmp/vorn'
      })
    )
  })

  it('New terminal creates a shell in active project', async () => {
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
    await new Promise((r) => setTimeout(r, 0))

    expect(onClose).toHaveBeenCalled()
    expect(mockCreateShellTerminal).toHaveBeenCalledWith('/tmp/vorn')
    expect(addTerminal).toHaveBeenCalledWith(shellSession)
    expect(setActiveTabId).toHaveBeenCalledWith('sh-1')
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

  it('clicking a worktree in the submenu creates session on that worktree', async () => {
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
})
