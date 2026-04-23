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

const mockExecuteWorkflow = vi.fn()
vi.mock('../src/renderer/lib/workflow-execution', () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args)
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
  it('renders New session, New terminal, and scoped submenus', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session')).toBeInTheDocument()
    expect(screen.getByText('New terminal')).toBeInTheDocument()
    expect(screen.getByText('New session in…')).toBeInTheDocument()
    expect(screen.getByText('New terminal in…')).toBeInTheDocument()
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
  })

  it('"New session in…" submenu groups worktrees under project header', () => {
    const cache = new Map()
    cache.set('/tmp/vorn', [
      { path: '/tmp/vorn', branch: 'main', isMain: true, name: 'vorn' },
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false, name: 'feat-a' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByText('New session in…').closest('button')!)

    // Project name as group header
    expect(screen.getByText('Vorn')).toBeInTheDocument()
    // Worktree entries underneath (just branch names, not prefixed)
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('feat-a')).toBeInTheDocument()
  })

  it('"New terminal in…" submenu groups worktrees under project header', () => {
    const cache = new Map()
    cache.set('/tmp/vorn', [
      { path: '/tmp/vorn', branch: 'main', isMain: true, name: 'vorn' },
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false, name: 'feat-a' }
    ])
    useAppStore.setState({ worktreeCache: cache })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByText('New terminal in…').closest('button')!)

    expect(screen.getByText('Vorn')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('feat-a')).toBeInTheDocument()
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

  it('shows "Run workflow" when workspace has workflows', () => {
    const configWithWorkflows = {
      ...mockConfig,
      workflows: [
        {
          id: 'wf-1',
          name: 'Deploy',
          icon: 'Rocket',
          iconColor: '#ff6600',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ config: configWithWorkflows as any })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('Run workflow')).toBeInTheDocument()
  })

  it('does not show "Run workflow" when no workflows exist', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.queryByText('Run workflow')).not.toBeInTheDocument()
  })

  it('"Run workflow" submenu shows workflow names and executes on click', () => {
    const configWithWorkflows = {
      ...mockConfig,
      workflows: [
        {
          id: 'wf-1',
          name: 'Deploy Staging',
          icon: 'Rocket',
          iconColor: '#ff6600',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ config: configWithWorkflows as any })

    const onClose = vi.fn()
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.mouseEnter(screen.getByText('Run workflow').closest('button')!)
    expect(screen.getByText('Deploy Staging')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Deploy Staging'))
    expect(onClose).toHaveBeenCalled()
    expect(mockExecuteWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wf-1', name: 'Deploy Staging' }),
      undefined,
      { source: 'manual' }
    )
  })

  it('only shows workflows from the active workspace in "Run workflow"', () => {
    const configWithWorkflows = {
      ...mockConfig,
      workflows: [
        {
          id: 'wf-1',
          name: 'Personal Deploy',
          icon: 'Zap',
          iconColor: '#fff',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        },
        {
          id: 'wf-2',
          name: 'Work Deploy',
          icon: 'Zap',
          iconColor: '#fff',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'work'
        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ config: configWithWorkflows as any, activeWorkspace: 'personal' })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    fireEvent.mouseEnter(screen.getByText('Run workflow').closest('button')!)
    expect(screen.getByText('Personal Deploy')).toBeInTheDocument()
    expect(screen.queryByText('Work Deploy')).not.toBeInTheDocument()
  })
})
