// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { WorkflowSubGroup } from '../src/renderer/components/project-sidebar/WorkflowSubGroup'

vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react')
  return {
    ...actual,
    ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron" {...props} />
  }
})

const icon = <span data-testid="group-icon" />

describe('WorkflowSubGroup', () => {
  it('renders label and count badge', () => {
    render(
      <WorkflowSubGroup label="Manual" icon={icon} count={3} defaultCollapsed={false}>
        <div>child</div>
      </WorkflowSubGroup>
    )
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides count badge when count is 0', () => {
    const { container } = render(
      <WorkflowSubGroup label="Manual" icon={icon} count={0} defaultCollapsed={false}>
        <div>child</div>
      </WorkflowSubGroup>
    )
    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument()
  })

  it('starts collapsed when defaultCollapsed=true', () => {
    render(
      <WorkflowSubGroup label="Manual" icon={icon} count={1} defaultCollapsed={true}>
        <div>child content</div>
      </WorkflowSubGroup>
    )
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })

  it('starts expanded when defaultCollapsed=false', () => {
    render(
      <WorkflowSubGroup label="Manual" icon={icon} count={1} defaultCollapsed={false}>
        <div>child content</div>
      </WorkflowSubGroup>
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('toggles collapsed/expanded on click', () => {
    render(
      <WorkflowSubGroup label="Manual" icon={icon} count={1} defaultCollapsed={true}>
        <div>child content</div>
      </WorkflowSubGroup>
    )
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Manual'))
    expect(screen.getByText('child content')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Manual'))
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })

  it('shows "None" when count is 0 and expanded', () => {
    render(
      <WorkflowSubGroup label="Manual" icon={icon} count={0} defaultCollapsed={false}>
        <div>child content</div>
      </WorkflowSubGroup>
    )
    expect(screen.getByText('None')).toBeInTheDocument()
    expect(screen.queryByText('child content')).not.toBeInTheDocument()
  })
})
