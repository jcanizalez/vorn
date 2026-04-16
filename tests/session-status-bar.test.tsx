// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'

vi.mock('../src/renderer/components/TerminalInstance', () => ({
  TerminalInstance: () => <div data-testid="terminal-instance" />
}))
vi.mock('../src/renderer/components/PromptLauncher', () => ({
  PromptLauncher: () => null
}))
vi.mock('../src/renderer/components/CardContextMenu', () => ({
  CardContextMenu: () => null
}))
vi.mock('../src/renderer/components/BackgroundTray', () => ({
  BackgroundTray: () => null
}))
vi.mock('../src/renderer/components/MobileFontSizeControl', () => ({
  MobileFontSizeControl: () => null
}))
vi.mock('../src/renderer/components/MobileTerminalKeybar', () => ({
  MobileTerminalKeybar: () => null
}))
vi.mock('../src/renderer/components/OpenInButton', () => ({
  OpenInButton: () => <div data-testid="open-in" />
}))
vi.mock('../src/renderer/components/GitChangesIndicator', () => ({
  GitChangesIndicator: () => <div data-testid="git-changes" />,
  BrowseFilesButton: () => <div data-testid="browse-files" />
}))
vi.mock('../src/renderer/components/GridContextMenu', () => ({
  GridContextMenu: () => null
}))
vi.mock('../src/renderer/hooks/useIsMobile', () => ({
  useIsMobile: () => false
}))
vi.mock('../src/renderer/hooks/useTerminalScrollButton', () => ({
  useTerminalScrollButton: () => ({ showScrollBtn: false, handleScrollToBottom: vi.fn() })
}))
vi.mock('../src/renderer/hooks/useTerminalPinchZoom', () => ({
  useTerminalPinchZoom: vi.fn()
}))
vi.mock('../src/renderer/hooks/useVisibleTerminals', () => ({
  useVisibleTerminals: () => ({ orderedIds: ['term-1'], minimizedIds: [] })
}))
vi.mock('../src/renderer/hooks/useFilteredHeadless', () => ({
  useFilteredHeadless: () => []
}))
vi.mock('../src/renderer/lib/terminal-close', () => ({
  closeTerminalSession: vi.fn()
}))
vi.mock('../src/renderer/lib/session-utils', () => ({
  resolveActiveProject: () => null
}))
vi.mock('../src/renderer/components/Toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('../src/renderer/components/Tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>
}))
vi.mock('../src/renderer/components/ConfirmPopover', () => ({
  ConfirmPopover: ({ children }: { children: ReactNode }) => <>{children}</>
}))

Object.defineProperty(window, 'api', {
  value: {
    killTerminal: vi.fn(),
    saveConfig: vi.fn(),
    notifyWidgetStatus: vi.fn(),
    getGitDiffStat: vi.fn().mockResolvedValue(null),
    createTerminal: vi.fn()
  },
  writable: true
})

import { useAppStore } from '../src/renderer/stores'
import { SessionStatusBar } from '../src/renderer/components/SessionStatusBar'
import { TabView } from '../src/renderer/components/TabView'
import { FocusedTerminal } from '../src/renderer/components/FocusedTerminal'

const mockTerminal = {
  id: 'term-1',
  session: {
    id: 'term-1',
    agentType: 'claude' as const,
    projectName: 'Vorn',
    projectPath: '/tmp/vorn',
    status: 'running' as const,
    createdAt: Date.now(),
    pid: 1234,
    branch: 'main',
    isWorktree: false
  },
  status: 'running' as const,
  lastOutputTimestamp: Date.now()
}

const initialState = useAppStore.getState()

beforeEach(() => {
  const terminals = new Map()
  terminals.set('term-1', mockTerminal)
  useAppStore.setState({
    terminals,
    activeTabId: 'term-1',
    focusedTerminalId: null,
    previewTerminalId: null,
    statusFilter: 'all',
    sortMode: 'manual',
    renamingTerminalId: null
  })
})

afterEach(() => {
  useAppStore.setState(initialState)
})

describe('SessionStatusBar (homologated bottom bar)', () => {
  it('renders the branch label for the given terminal', () => {
    render(<SessionStatusBar terminalId="term-1" />)
    expect(screen.getByText('main')).toBeInTheDocument()
  })

  it('renders nothing when the terminal is missing', () => {
    const { container } = render(<SessionStatusBar terminalId="nonexistent" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders worktree label for worktree sessions', () => {
    const terminals = new Map()
    terminals.set('wt-1', {
      id: 'wt-1',
      session: {
        ...mockTerminal.session,
        id: 'wt-1',
        branch: 'feature-x',
        isWorktree: true,
        worktreePath: '/tmp/wt/feature-x'
      },
      status: 'running' as const,
      lastOutputTimestamp: Date.now()
    })
    useAppStore.setState({ terminals })
    render(<SessionStatusBar terminalId="wt-1" />)
    expect(screen.getByText('worktree')).toBeInTheDocument()
  })
})

describe('TabView mounts SessionStatusBar at the bottom', () => {
  it('renders the shared status bar so branch appears below the terminal', () => {
    const { container } = render(<TabView />)
    // SessionStatusBar sits at the bottom and displays the branch label.
    // Use within + the git-changes testid as an anchor to target the bar.
    const gitChanges = screen.getByTestId('git-changes')
    const bar = gitChanges.closest('div.border-t') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(within(bar!).getByText('main')).toBeInTheDocument()
    // Sanity: terminal instance also mounted
    expect(container.querySelector('[data-testid="terminal-instance"]')).toBeInTheDocument()
  })
})

describe('FocusedTerminal mounts SessionStatusBar at the bottom on desktop', () => {
  it('moves branch, git changes, and open-in into the shared bottom bar', () => {
    useAppStore.setState({ focusedTerminalId: 'term-1' })
    render(<FocusedTerminal />)
    const gitChanges = screen.getByTestId('git-changes')
    const bar = gitChanges.closest('div.border-t') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(within(bar!).getByText('main')).toBeInTheDocument()
    expect(within(bar!).getByTestId('open-in')).toBeInTheDocument()
    expect(within(bar!).getByTestId('browse-files')).toBeInTheDocument()
  })
})
