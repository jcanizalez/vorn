// @vitest-environment jsdom
import { forwardRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'api', {
  value: {
    isWorktreeDirty: vi.fn().mockResolvedValue(false),
    getGitDiffStat: vi.fn().mockResolvedValue(null),
    getGitBranch: vi.fn().mockResolvedValue(null),
    notifyWidgetStatus: vi.fn()
  },
  writable: true
})

// Stub AgentCard with forwardRef so GridView's ref callback (which calls
// cardRefs.current.set(id, el)) actually fires.
vi.mock('../src/renderer/components/AgentCard', () => ({
  AgentCard: forwardRef<
    HTMLDivElement,
    { terminalId: string; index: number; isDragTarget: boolean }
  >(function MockAgentCard({ terminalId, index, isDragTarget }, ref) {
    return (
      <div
        ref={ref}
        data-testid={`card-${terminalId}`}
        data-index={index}
        data-drag-target={isDragTarget ? 'yes' : 'no'}
      />
    )
  })
}))

vi.mock('../src/renderer/components/BackgroundTray', () => ({
  BackgroundTray: () => null
}))

vi.mock('../src/renderer/components/PromptLauncher', () => ({
  PromptLauncher: () => null
}))

vi.mock('../src/renderer/components/GridContextMenu', () => ({
  GridContextMenu: () => null
}))

vi.mock('../src/renderer/hooks/useIsMobile', () => ({
  useIsMobile: () => false
}))

vi.mock('../src/renderer/hooks/useFilteredHeadless', () => ({
  useFilteredHeadless: () => []
}))

import { useAppStore } from '../src/renderer/stores'
import { GridView } from '../src/renderer/components/GridView'

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

function makeTerminal(id: string, status: 'idle' | 'running' = 'idle') {
  return {
    id,
    session: {
      id,
      agentType: 'claude' as const,
      projectName: 'Vorn',
      projectPath: '/tmp/vorn',
      isWorktree: false,
      branch: 'main',
      createdAt: Date.now()
    },
    status,
    lastOutputTimestamp: Date.now()
  }
}

beforeEach(() => {
  const terminals = new Map()
  terminals.set('term-a', makeTerminal('term-a'))
  terminals.set('term-b', makeTerminal('term-b', 'running'))

  useAppStore.setState({
    terminals,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: mockConfig as any,
    activeProject: 'Vorn',
    activeWorktreePath: null,
    activeWorkspace: 'personal',
    gridColumns: 2,
    sortMode: 'manual',
    statusFilter: 'all',
    focusedTerminalId: null,
    previewTerminalId: null,
    minimizedTerminals: new Set<string>(),
    rowHeight: 208,
    terminalOrder: ['term-a', 'term-b']
  })
})

describe('GridView', () => {
  it('renders an AgentCard for each terminal in the active project', () => {
    render(<GridView />)
    expect(screen.getByTestId('card-term-a')).toBeInTheDocument()
    expect(screen.getByTestId('card-term-b')).toBeInTheDocument()
  })

  it('passes the card index in sort order', () => {
    render(<GridView />)
    expect(screen.getByTestId('card-term-a').dataset.index).toBe('0')
    expect(screen.getByTestId('card-term-b').dataset.index).toBe('1')
  })

  it('omits the drag-start handler when sort mode is not manual', () => {
    useAppStore.setState({ sortMode: 'created' })
    render(<GridView />)
    expect(screen.getByTestId('card-term-a').dataset.dragTarget).toBe('no')
  })
})
