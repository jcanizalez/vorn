// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { StatusBadge } from '../src/renderer/components/StatusBadge'
import type { AgentStatus } from '../src/shared/types'

vi.mock('../src/renderer/components/Tooltip', () => ({
  Tooltip: ({ children, label }: { children: ReactNode; label: string }) => (
    <span data-testid="tooltip" data-label={label}>
      {children}
    </span>
  )
}))

describe('StatusBadge', () => {
  it('renders the shimmer glyph for running', () => {
    const { container } = render(<StatusBadge status="running" />)
    const glyph = container.querySelector('[data-component="shimmer-glyph"]')
    expect(glyph).toBeInTheDocument()
    expect(glyph).toHaveClass('text-green-400')
    expect(screen.getByRole('img', { name: 'Running' })).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toHaveAttribute('data-label', 'Running')
  })

  it.each<AgentStatus>(['idle', 'waiting', 'error'])('renders nothing for %s status', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(container.firstChild).toBeNull()
  })
})
