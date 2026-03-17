// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { StatusBadge } from '../src/renderer/components/StatusBadge'
import type { AgentStatus } from '../src/shared/types'

describe('StatusBadge', () => {
  const statuses: AgentStatus[] = ['running', 'waiting', 'idle', 'error']

  it.each(statuses)('renders label for %s status', (status) => {
    render(<StatusBadge status={status} />)
    const expected = status.charAt(0).toUpperCase() + status.slice(1)
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it('shows pulse animation for running status', () => {
    const { container } = render(<StatusBadge status="running" />)
    const pulse = container.querySelector('.animate-ping')
    expect(pulse).toBeInTheDocument()
  })

  it('shows pulse animation for waiting status', () => {
    const { container } = render(<StatusBadge status="waiting" />)
    const pulse = container.querySelector('.animate-ping')
    expect(pulse).toBeInTheDocument()
  })

  it('does not pulse for idle status', () => {
    const { container } = render(<StatusBadge status="idle" />)
    const pulse = container.querySelector('.animate-ping')
    expect(pulse).not.toBeInTheDocument()
  })

  it('does not pulse for error status', () => {
    const { container } = render(<StatusBadge status="error" />)
    const pulse = container.querySelector('.animate-ping')
    expect(pulse).not.toBeInTheDocument()
  })

  it('applies correct color class for running', () => {
    const { container } = render(<StatusBadge status="running" />)
    const dot = container.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
  })

  it('applies correct color class for error', () => {
    const { container } = render(<StatusBadge status="error" />)
    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeInTheDocument()
  })
})
