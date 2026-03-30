// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { WorkflowContextMenu } from '../src/renderer/components/project-sidebar/WorkflowContextMenu'

describe('WorkflowContextMenu', () => {
  it('renders Edit and Delete buttons', () => {
    render(<WorkflowContextMenu onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Edit Workflow')).toBeInTheDocument()
    expect(screen.getByText('Delete Workflow')).toBeInTheDocument()
  })

  it('shows "Disable Schedule" when isScheduled and isEnabled', () => {
    render(
      <WorkflowContextMenu
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
        isScheduled={true}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    )
    expect(screen.getByText('Disable Schedule')).toBeInTheDocument()
  })

  it('shows "Enable Schedule" when isScheduled and not isEnabled', () => {
    render(
      <WorkflowContextMenu
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
        isScheduled={true}
        isEnabled={false}
        onToggleEnabled={vi.fn()}
      />
    )
    expect(screen.getByText('Enable Schedule')).toBeInTheDocument()
  })

  it('hides toggle when not scheduled', () => {
    render(<WorkflowContextMenu onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('Disable Schedule')).not.toBeInTheDocument()
    expect(screen.queryByText('Enable Schedule')).not.toBeInTheDocument()
  })

  it('calls onToggleEnabled + onClose on toggle click', () => {
    const onToggle = vi.fn()
    const onClose = vi.fn()
    render(
      <WorkflowContextMenu
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
        isScheduled={true}
        isEnabled={true}
        onToggleEnabled={onToggle}
      />
    )
    fireEvent.click(screen.getByText('Disable Schedule'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on click outside', () => {
    const onClose = vi.fn()
    render(
      <div>
        <div data-testid="outside">outside</div>
        <WorkflowContextMenu onEdit={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
      </div>
    )
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
