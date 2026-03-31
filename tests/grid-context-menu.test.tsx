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

import { useAppStore } from '../src/renderer/stores'
import { GridContextMenu } from '../src/renderer/components/GridContextMenu'

const mockConfig = {
  projects: [
    {
      name: 'VibeGrid',
      path: '/tmp/vibegrid',
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
    activeProject: 'VibeGrid',
    activeWorktreePath: null,
    activeWorkspace: 'personal',
    worktreeCache: new Map()
  })
})

describe('GridContextMenu', () => {
  it('renders smart quick-launch with active project name', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session in VibeGrid')).toBeInTheDocument()
  })

  it('renders worktree submenu item with project name', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session in VibeGrid...')).toBeInTheDocument()
  })

  it('renders "New session..." for full dialog', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.getByText('New session...')).toBeInTheDocument()
  })

  it('does not show old flat "New session in worktree" label', () => {
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)
    expect(screen.queryByText('New session in worktree')).not.toBeInTheDocument()
  })

  it('shows "New session from..." with project list in All Projects view', () => {
    useAppStore.setState({ activeProject: null })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    // Quick launch should use first project from resolveActiveProject
    expect(screen.getByText(/New session in VibeGrid/)).toBeInTheDocument()

    // Should show "New session from..." submenu
    expect(screen.getByText('New session from...')).toBeInTheDocument()
  })

  it('shows all workspace projects in submenu when in All Projects view', () => {
    useAppStore.setState({ activeProject: null })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const submenuTrigger = screen.getByText('New session from...')
    fireEvent.mouseEnter(submenuTrigger.closest('button')!)

    expect(screen.getByText('VibeGrid')).toBeInTheDocument()
    expect(screen.getByText('OtherApp')).toBeInTheDocument()
  })

  it('shows worktree submenu with cached worktrees on hover', () => {
    const cache = new Map()
    cache.set('/tmp/vibegrid', [
      { path: '/tmp/wt/feat-a', branch: 'feat-a', isMain: false },
      { path: '/tmp/wt/feat-b', branch: 'feat-b', isMain: false }
    ])
    useAppStore.setState({ worktreeCache: cache })

    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={vi.fn()} />)

    const submenuTrigger = screen.getByText('New session in VibeGrid...')
    fireEvent.mouseEnter(submenuTrigger.closest('button')!)

    expect(screen.getByText('feat-a')).toBeInTheDocument()
    expect(screen.getByText('feat-b')).toBeInTheDocument()
    expect(screen.getByText('New worktree')).toBeInTheDocument()
  })

  it('quick-launch creates terminal with active project', async () => {
    mockCreateTerminal.mockResolvedValue({
      id: 'new-term',
      session: {
        id: 'new-term',
        agentType: 'claude',
        projectName: 'VibeGrid',
        projectPath: '/tmp/vibegrid'
      },
      status: 'idle',
      lastOutputTimestamp: Date.now()
    })

    const onClose = vi.fn()
    render(<GridContextMenu position={{ x: 100, y: 100 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('New session in VibeGrid'))

    expect(onClose).toHaveBeenCalled()
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'claude',
        projectName: 'VibeGrid',
        projectPath: '/tmp/vibegrid'
      })
    )
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
})
