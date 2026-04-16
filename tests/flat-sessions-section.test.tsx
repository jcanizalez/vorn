// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mockStore = {
  terminals: new Map(),
  activeProject: null as string | null,
  setActiveProject: vi.fn(),
  setFocusedTerminal: vi.fn(),
  sidebarProjectSort: 'manual',
  sidebarWorktreeSort: 'name',
  sidebarWorktreeFilter: 'all',
  sidebarViewMode: 'sessions-flat',
  setSidebarProjectSort: vi.fn(),
  setSidebarWorktreeSort: vi.fn(),
  setSidebarWorktreeFilter: vi.fn(),
  setSidebarViewMode: vi.fn()
}

vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    return selector ? selector(mockStore) : mockStore
  }
}))

const { FlatSessionsSection } =
  await import('../src/renderer/components/project-sidebar/FlatSessionsSection')

beforeEach(() => {
  mockStore.terminals.clear()
  mockStore.activeProject = null
  mockStore.setActiveProject.mockReset()
  mockStore.setFocusedTerminal.mockReset()
})

describe('FlatSessionsSection', () => {
  it('renders the Sessions header and All Projects button', () => {
    render(
      <FlatSessionsSection
        isCollapsed={false}
        workspaceProjectNames={new Set(['p1'])}
        workspaceTerminalCount={3}
      />
    )
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('All Projects')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('collapses when the Sessions header is clicked', () => {
    render(
      <FlatSessionsSection
        isCollapsed={false}
        workspaceProjectNames={new Set()}
        workspaceTerminalCount={0}
      />
    )
    fireEvent.click(screen.getByText('Sessions'))
    expect(screen.queryByText('All Projects')).not.toBeInTheDocument()
  })

  it('clears active project and focused terminal when All Projects is clicked', () => {
    render(
      <FlatSessionsSection
        isCollapsed={false}
        workspaceProjectNames={new Set()}
        workspaceTerminalCount={0}
      />
    )
    fireEvent.click(screen.getByText('All Projects'))
    expect(mockStore.setActiveProject).toHaveBeenCalledWith(null)
    expect(mockStore.setFocusedTerminal).toHaveBeenCalledWith(null)
  })

  it('shows empty state when there are no sessions', () => {
    render(
      <FlatSessionsSection
        isCollapsed={false}
        workspaceProjectNames={new Set()}
        workspaceTerminalCount={0}
      />
    )
    expect(screen.getByText('No active sessions')).toBeInTheDocument()
  })
})
