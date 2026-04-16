// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { WorkflowPropertiesPanel } from '../src/renderer/components/workflow-editor/panels/WorkflowPropertiesPanel'
import type { WorkflowNode, WorkflowExecution } from '../src/shared/types'

function makeTrigger(triggerType: 'manual' | 'recurring'): WorkflowNode {
  return {
    id: 't1',
    type: 'trigger',
    label: 'Trigger',
    config:
      triggerType === 'manual'
        ? { triggerType: 'manual' }
        : { triggerType: 'recurring', cron: '0 9 * * *' },
    position: { x: 0, y: 0 }
  }
}

const baseProps = {
  enabled: true,
  onEnabledChange: vi.fn(),
  staggerDelayMs: undefined as number | undefined,
  onStaggerChange: vi.fn(),
  autoCleanupWorktrees: false,
  onCleanupChange: vi.fn(),
  triggerNode: null as WorkflowNode | null,
  onSelectTrigger: vi.fn(),
  lastRun: null as WorkflowExecution | null,
  onClose: vi.fn()
}

describe('WorkflowPropertiesPanel', () => {
  it('renders Properties header and a close button', () => {
    render(<WorkflowPropertiesPanel {...baseProps} />)
    expect(screen.getByText('Properties')).toBeInTheDocument()
  })

  it('shows "Enabled" label when enabled is true and "Disabled" when false', () => {
    const { rerender } = render(<WorkflowPropertiesPanel {...baseProps} enabled={true} />)
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    rerender(<WorkflowPropertiesPanel {...baseProps} enabled={false} />)
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('preserves a 0ms stagger delay value in the input', () => {
    render(<WorkflowPropertiesPanel {...baseProps} staggerDelayMs={0} />)
    const input = screen.getByPlaceholderText('0ms') as HTMLInputElement
    expect(input.value).toBe('0')
  })

  it('shows trigger summary when a trigger node is provided', () => {
    render(<WorkflowPropertiesPanel {...baseProps} triggerNode={makeTrigger('manual')} />)
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('shows recurring cron summary when trigger is recurring', () => {
    render(<WorkflowPropertiesPanel {...baseProps} triggerNode={makeTrigger('recurring')} />)
    expect(screen.getByText(/Recurring/)).toBeInTheDocument()
  })

  it('shows "None" when there is no trigger node', () => {
    render(<WorkflowPropertiesPanel {...baseProps} triggerNode={null} />)
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<WorkflowPropertiesPanel {...baseProps} onClose={onClose} />)
    const buttons = screen.getAllByRole('button')
    const closeButton = buttons.find((b) => b.querySelector('svg'))
    if (closeButton) fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
