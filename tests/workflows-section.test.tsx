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
})
