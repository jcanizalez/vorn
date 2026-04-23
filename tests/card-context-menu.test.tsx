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

vi.mock('../src/renderer/lib/terminal-close', () => ({
  closeTerminalSession: vi.fn()
}))

vi.mock('../src/renderer/hooks/useIsMobile', () => ({
  useIsMobile: () => false
}))

const mockExecuteWorkflow = vi.fn()
vi.mock('../src/renderer/lib/workflow-execution', () => ({
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args)
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

  it('still renders Expand, Rename, New terminal, and Close items', () => {
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('Expand')).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('New terminal')).toBeInTheDocument()
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

  it('shows "Run workflow" submenu when workspace has workflows', () => {
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
        },
        {
          id: 'wf-2',
          name: 'Run Tests',
          icon: 'Play',
          iconColor: '#00ff00',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ config: configWithWorkflows as any })

    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('Run workflow')).toBeInTheDocument()
  })

  it('does not show "Run workflow" when no workflows exist', () => {
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.queryByText('Run workflow')).not.toBeInTheDocument()
  })

  it('shows workflow names in submenu on hover and executes on click', () => {
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
    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={onClose} />)

    const trigger = screen.getByText('Run workflow')
    fireEvent.mouseEnter(trigger.closest('button')!)

    expect(screen.getByText('Deploy Staging')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Deploy Staging'))
    expect(onClose).toHaveBeenCalled()
    expect(mockExecuteWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wf-1', name: 'Deploy Staging' }),
      undefined,
      { source: 'manual' }
    )
  })

  it('only shows workflows from the active workspace', () => {
    const configWithWorkflows = {
      ...mockConfig,
      workflows: [
        {
          id: 'wf-1',
          name: 'Personal WF',
          icon: 'Zap',
          iconColor: '#fff',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        },
        {
          id: 'wf-2',
          name: 'Work WF',
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

    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const trigger = screen.getByText('Run workflow')
    fireEvent.mouseEnter(trigger.closest('button')!)

    expect(screen.getByText('Personal WF')).toBeInTheDocument()
    expect(screen.queryByText('Work WF')).not.toBeInTheDocument()
  })

  it('excludes scheduled workflows from "Run workflow" submenu', () => {
    const configWithWorkflows = {
      ...mockConfig,
      workflows: [
        {
          id: 'wf-manual',
          name: 'Manual Deploy',
          icon: 'Zap',
          iconColor: '#fff',
          nodes: [],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        },
        {
          id: 'wf-scheduled',
          name: 'Nightly Build',
          icon: 'Zap',
          iconColor: '#fff',
          nodes: [
            {
              id: 'trigger-1',
              type: 'trigger',
              config: { triggerType: 'recurring', cron: '0 0 * * *' },
              position: { x: 0, y: 0 },
              label: 'Schedule'
            }
          ],
          edges: [],
          enabled: true,
          workspaceId: 'personal'
        }
      ]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppStore.setState({ config: configWithWorkflows as any, activeWorkspace: 'personal' })

    render(<CardContextMenu terminalId="term-1" position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const trigger = screen.getByText('Run workflow')
    fireEvent.mouseEnter(trigger.closest('button')!)

    expect(screen.getByText('Manual Deploy')).toBeInTheDocument()
    expect(screen.queryByText('Nightly Build')).not.toBeInTheDocument()
  })
})
