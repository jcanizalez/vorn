// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { WorkflowDefinition } from '../src/shared/types'

const mockStore = {
  setEditingWorkflowId: vi.fn(),
  setWorkflowEditorOpen: vi.fn(),
  workflowExecutions: new Map<string, unknown>()
}

vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    return selector ? selector(mockStore) : mockStore
  }
}))

const execute = vi.fn()
vi.mock('../src/renderer/lib/workflow-execution', () => ({
  executeWorkflow: (...args: unknown[]) => execute(...args)
}))

const { WorkflowItem } = await import('../src/renderer/components/project-sidebar/WorkflowItem')

function makeManual(): WorkflowDefinition {
  return {
    id: 'w1',
    name: 'My Workflow',
    icon: 'Zap',
    iconColor: '#ffffff',
    nodes: [
      {
        id: 't',
        type: 'trigger',
        label: 'T',
        config: { triggerType: 'manual' },
        position: { x: 0, y: 0 }
      }
    ],
    edges: [],
    enabled: true
  }
}

function makeScheduled(enabled = true): WorkflowDefinition {
  return {
    ...makeManual(),
    id: 'w2',
    nodes: [
      {
        id: 't',
        type: 'trigger',
        label: 'T',
        config: { triggerType: 'recurring', cron: '* * * * *' },
        position: { x: 0, y: 0 }
      }
    ],
    enabled
  }
}

beforeEach(() => {
  mockStore.setEditingWorkflowId.mockReset()
  mockStore.setWorkflowEditorOpen.mockReset()
  execute.mockReset()
})

describe('WorkflowItem', () => {
  it('renders the workflow name', () => {
    render(
      <WorkflowItem
        workflow={makeManual()}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={vi.fn()}
      />
    )
    expect(screen.getByText('My Workflow')).toBeInTheDocument()
  })

  it('opens the editor when the row is clicked', () => {
    render(
      <WorkflowItem
        workflow={makeManual()}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('My Workflow'))
    expect(mockStore.setEditingWorkflowId).toHaveBeenCalledWith('w1')
    expect(mockStore.setWorkflowEditorOpen).toHaveBeenCalledWith(true)
  })

  it('executes the workflow when the Run button is clicked', () => {
    render(
      <WorkflowItem
        workflow={makeManual()}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={vi.fn()}
      />
    )
    const runButton = screen.getByRole('button', { name: /Run workflow/ })
    fireEvent.click(runButton)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('calls onContextMenu on right-click', () => {
    const onContextMenu = vi.fn()
    render(
      <WorkflowItem
        workflow={makeManual()}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={onContextMenu}
      />
    )
    fireEvent.contextMenu(screen.getByText('My Workflow'))
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), 'w1')
  })

  it('calls onContextMenu when the More button is clicked', () => {
    const onContextMenu = vi.fn()
    render(
      <WorkflowItem
        workflow={makeManual()}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={onContextMenu}
      />
    )
    const moreButton = screen.getByRole('button', { name: /More options/ })
    fireEvent.click(moreButton)
    expect(onContextMenu).toHaveBeenCalledWith(expect.anything(), 'w1')
  })

  it('renders a blue status dot for scheduled + enabled workflows', () => {
    const { container } = render(
      <WorkflowItem
        workflow={makeScheduled(true)}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={vi.fn()}
      />
    )
    expect(container.querySelector('.bg-blue-400')).toBeInTheDocument()
  })

  it('renders a gray dot and dims the row for scheduled + disabled workflows', () => {
    const { container } = render(
      <WorkflowItem
        workflow={makeScheduled(false)}
        isCollapsed={false}
        iconSize={14}
        onContextMenu={vi.fn()}
      />
    )
    expect(container.querySelector('.bg-gray-600')).toBeInTheDocument()
    expect(container.querySelector('.opacity-40')).toBeInTheDocument()
  })

  it('renders a red dot when lastRunStatus is error', () => {
    const wf = { ...makeManual(), lastRunStatus: 'error' as const }
    const { container } = render(
      <WorkflowItem workflow={wf} isCollapsed={false} iconSize={14} onContextMenu={vi.fn()} />
    )
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument()
  })

  it('hides the name and action buttons when collapsed', () => {
    render(
      <WorkflowItem
        workflow={makeManual()}
        isCollapsed={true}
        iconSize={22}
        onContextMenu={vi.fn()}
      />
    )
    expect(screen.queryByText('My Workflow')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Run workflow/ })).not.toBeInTheDocument()
  })
})
