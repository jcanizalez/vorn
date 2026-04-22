// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const mockStore = {
  toggleSidebar: vi.fn(),
  setMainViewMode: vi.fn(),
  config: { defaults: { mainViewMode: 'sessions' as 'sessions' | 'tasks' } }
}

vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    return selector ? selector(mockStore) : mockStore
  }
}))

vi.mock('../src/renderer/components/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => <div data-testid="workspace-switcher" />
}))

const { SidebarHeader } = await import('../src/renderer/components/project-sidebar/SidebarHeader')

beforeEach(() => {
  mockStore.toggleSidebar.mockReset()
  mockStore.setMainViewMode.mockReset()
  mockStore.config.defaults.mainViewMode = 'sessions'
})

describe('SidebarHeader', () => {
  it('renders Sessions and Tasks toggle buttons with accessible names', () => {
    render(<SidebarHeader isCollapsed={false} />)
    expect(screen.getByRole('button', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tasks' })).toBeInTheDocument()
  })

  it('marks the active view with aria-pressed', () => {
    render(<SidebarHeader isCollapsed={false} />)
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Tasks' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches view mode when a toggle is clicked', () => {
    render(<SidebarHeader isCollapsed={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }))
    expect(mockStore.setMainViewMode).toHaveBeenCalledWith('tasks')
  })

  it('renders workspace switcher and toggles sidebar when expanded', () => {
    render(<SidebarHeader isCollapsed={false} />)
    expect(screen.getByTestId('workspace-switcher')).toBeInTheDocument()
    const [sidebarToggle] = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label') === null)
    fireEvent.click(sidebarToggle)
    expect(mockStore.toggleSidebar).toHaveBeenCalled()
  })

  it('hides workspace switcher and sidebar toggle when collapsed', () => {
    render(<SidebarHeader isCollapsed={true} />)
    expect(screen.queryByTestId('workspace-switcher')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sessions' })).toBeInTheDocument()
  })

  it('reflects tasks as active when mainViewMode is tasks', () => {
    mockStore.config.defaults.mainViewMode = 'tasks'
    render(<SidebarHeader isCollapsed={false} />)
    expect(screen.getByRole('button', { name: 'Tasks' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })
})
