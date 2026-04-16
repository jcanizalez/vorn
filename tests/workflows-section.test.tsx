// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { WorkflowDefinition } from '../src/shared/types'

const mockStore = {
  setWorkflowEditorOpen: vi.fn(),
  setEditingWorkflowId: vi.fn(),
  removeWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  reorderWorkflows: vi.fn(),
  sidebarWorkflowFilter: 'all' as 'all' | 'manual' | 'scheduled',
  setSidebarWorkflowFilter: vi.fn()
}

vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    return selector ? selector(mockStore) : mockStore
  }
}))

vi.mock('../src/renderer/lib/workflow-execution', () => ({
  executeWorkflow: vi.fn()
}))

const { WorkflowsSection } =
  await import('../src/renderer/components/project-sidebar/WorkflowsSection')

function makeWorkflow(id: string, scheduled = false): WorkflowDefinition {
  return {
    id,
    name: `Flow ${id}`,
    icon: 'Zap',
    iconColor: '#fff',
    nodes: [
      {
        id: 't',
        type: 'trigger',
        label: 'T',
        config: scheduled
          ? { triggerType: 'recurring', cron: '* * * * *' }
          : { triggerType: 'manual' },
        position: { x: 0, y: 0 }
      }
    ],
    edges: [],
    enabled: true
  }
}

beforeEach(() => {
  mockStore.setWorkflowEditorOpen.mockReset()
  mockStore.setEditingWorkflowId.mockReset()
  mockStore.removeWorkflow.mockReset()
  mockStore.updateWorkflow.mockReset()
  mockStore.reorderWorkflows.mockReset()
  mockStore.setSidebarWorkflowFilter.mockReset()
  mockStore.sidebarWorkflowFilter = 'all'
})

describe('WorkflowsSection', () => {
  it('shows the section header when expanded', () => {
    const { container } = render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={[]} />)
    expect(screen.getByText('Workflows')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-zap')).toBeInTheDocument()
  })

  it('shows empty state when no workflows match the filter', () => {
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={[]} />)
    expect(screen.getByText('No workflows')).toBeInTheDocument()
  })

  it('renders each workflow row', () => {
    const workflows = [makeWorkflow('a'), makeWorkflow('b')]
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />)
    expect(screen.getByText('Flow a')).toBeInTheDocument()
    expect(screen.getByText('Flow b')).toBeInTheDocument()
  })

  it('opens the editor in new-workflow mode when + is clicked', () => {
    const { container } = render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={[]} />)
    const zapButton = container.querySelector('svg.lucide-zap')?.closest('button')
    if (zapButton) fireEvent.click(zapButton)
    expect(mockStore.setEditingWorkflowId).toHaveBeenCalledWith(null)
    expect(mockStore.setWorkflowEditorOpen).toHaveBeenCalledWith(true)
  })

  it('filters workflows to manual only when filter is set to manual', () => {
    mockStore.sidebarWorkflowFilter = 'manual'
    const workflows = [makeWorkflow('a', false), makeWorkflow('b', true)]
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />)
    expect(screen.getByText('Flow a')).toBeInTheDocument()
    expect(screen.queryByText('Flow b')).not.toBeInTheDocument()
  })

  it('filters workflows to scheduled only when filter is set to scheduled', () => {
    mockStore.sidebarWorkflowFilter = 'scheduled'
    const workflows = [makeWorkflow('a', false), makeWorkflow('b', true)]
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />)
    expect(screen.queryByText('Flow a')).not.toBeInTheDocument()
    expect(screen.getByText('Flow b')).toBeInTheDocument()
  })

  it('collapses the section when the header is clicked', () => {
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={[makeWorkflow('a')]} />)
    expect(screen.getByText('Flow a')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Workflows'))
    expect(screen.queryByText('Flow a')).not.toBeInTheDocument()
  })

  it('opens the context menu on right-click of a workflow row', () => {
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={[makeWorkflow('a')]} />)
    fireEvent.contextMenu(screen.getByText('Flow a'))
    expect(screen.getByText('Edit Workflow')).toBeInTheDocument()
    expect(screen.getByText('Delete Workflow')).toBeInTheDocument()
  })

  it('triggers reorderWorkflows on a successful drop', () => {
    const workflows = [makeWorkflow('a'), makeWorkflow('b')]
    const { container } = render(
      <WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />
    )
    const rows = container.querySelectorAll('div.cursor-grab')
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(key: string, value: string) {
        this.data[key] = value
      },
      getData(key: string) {
        return this.data[key]
      },
      effectAllowed: '',
      dropEffect: ''
    }
    fireEvent.dragStart(rows[0], { dataTransfer })
    fireEvent.dragOver(rows[1], { dataTransfer })
    fireEvent.drop(rows[1], { dataTransfer })
    expect(mockStore.reorderWorkflows).toHaveBeenCalledWith(0, 1)
  })

  it('renders compact icon-only rows when isCollapsed is true', () => {
    const workflows = [makeWorkflow('a')]
    render(<WorkflowsSection isCollapsed={true} workspaceWorkflows={workflows} />)
    expect(screen.queryByText('Workflows')).not.toBeInTheDocument()
    expect(screen.queryByText('Flow a')).not.toBeInTheDocument()
  })

  it('Edit Workflow menu item opens the editor for the right workflow', () => {
    const workflows = [makeWorkflow('a')]
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />)
    fireEvent.contextMenu(screen.getByText('Flow a'))
    fireEvent.click(screen.getByText('Edit Workflow'))
    expect(mockStore.setEditingWorkflowId).toHaveBeenCalledWith('a')
    expect(mockStore.setWorkflowEditorOpen).toHaveBeenCalledWith(true)
  })

  it('Delete Workflow menu item removes the workflow', () => {
    const workflows = [makeWorkflow('a')]
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />)
    fireEvent.contextMenu(screen.getByText('Flow a'))
    fireEvent.click(screen.getByText('Delete Workflow'))
    expect(mockStore.removeWorkflow).toHaveBeenCalledWith('a')
  })

  it('toggles Enable/Disable for scheduled workflows from the menu', () => {
    const workflows = [makeWorkflow('s', true)]
    render(<WorkflowsSection isCollapsed={false} workspaceWorkflows={workflows} />)
    fireEvent.contextMenu(screen.getByText('Flow s'))
    fireEvent.click(screen.getByText(/Disable Schedule|Enable Schedule/))
    expect(mockStore.updateWorkflow).toHaveBeenCalled()
  })
})
