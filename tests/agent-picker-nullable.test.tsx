// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AgentPicker } from '../src/renderer/components/AgentPicker'
import type { AgentType } from '../src/shared/types'

// Mock createPortal to render inline
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom')
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node
  }
})

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    )
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>
}))

const ALL_INSTALLED: Record<AgentType, boolean> = {
  claude: true,
  copilot: true,
  codex: true,
  opencode: true,
  gemini: true
}

describe('AgentPicker with allowNone', () => {
  let onChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onChange = vi.fn()
  })

  it('renders "Unassigned" when currentAgent is null', () => {
    const { getByText } = render(
      <AgentPicker
        currentAgent={null}
        onChange={onChange}
        installStatus={ALL_INSTALLED}
        allowNone
      />
    )
    expect(getByText('Unassigned')).toBeInTheDocument()
  })

  it('renders agent label when currentAgent is set', () => {
    const { getByText } = render(
      <AgentPicker
        currentAgent="claude"
        onChange={onChange}
        installStatus={ALL_INSTALLED}
        allowNone
      />
    )
    expect(getByText('Claude')).toBeInTheDocument()
  })

  it('shows "None" option in dropdown when allowNone is true', () => {
    const { getByText, getAllByRole } = render(
      <AgentPicker
        currentAgent="claude"
        onChange={onChange}
        installStatus={ALL_INSTALLED}
        allowNone
      />
    )
    // Open dropdown
    fireEvent.click(getAllByRole('button')[0])
    expect(getByText('None')).toBeInTheDocument()
  })

  it('does not show "None" option when allowNone is false', () => {
    const { queryByText, getAllByRole } = render(
      <AgentPicker currentAgent="claude" onChange={onChange} installStatus={ALL_INSTALLED} />
    )
    fireEvent.click(getAllByRole('button')[0])
    expect(queryByText('None')).not.toBeInTheDocument()
  })

  it('calls onChange(null) when "None" is selected', () => {
    const { getByText, getAllByRole } = render(
      <AgentPicker
        currentAgent="claude"
        onChange={onChange}
        installStatus={ALL_INSTALLED}
        allowNone
      />
    )
    fireEvent.click(getAllByRole('button')[0])
    fireEvent.click(getByText('None'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with agent type when an agent is selected', () => {
    const { getByText, getAllByRole } = render(
      <AgentPicker
        currentAgent={null}
        onChange={onChange}
        installStatus={ALL_INSTALLED}
        allowNone
      />
    )
    fireEvent.click(getAllByRole('button')[0])
    fireEvent.click(getByText('Copilot'))
    expect(onChange).toHaveBeenCalledWith('copilot')
  })

  it('does not call onChange for uninstalled agents', () => {
    const status = { ...ALL_INSTALLED, codex: false }
    const { getByText, getAllByRole } = render(
      <AgentPicker currentAgent="claude" onChange={onChange} installStatus={status} allowNone />
    )
    fireEvent.click(getAllByRole('button')[0])
    fireEvent.click(getByText('Codex'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows check mark on "None" when currentAgent is null', () => {
    const { container, getAllByRole } = render(
      <AgentPicker
        currentAgent={null}
        onChange={onChange}
        installStatus={ALL_INSTALLED}
        allowNone
      />
    )
    fireEvent.click(getAllByRole('button')[0])
    // The None button should contain a Check icon (svg with lucide class)
    const noneButton = container.querySelector('button .italic')?.closest('button')
    const checkIcon = noneButton?.querySelector('svg:last-child')
    expect(checkIcon).toBeInTheDocument()
  })
})
