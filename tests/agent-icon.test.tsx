// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AgentIcon } from '../src/renderer/components/AgentIcon'
import type { AgentType } from '../packages/shared/src/types'

describe('AgentIcon', () => {
  const types: AgentType[] = ['claude', 'copilot', 'codex', 'opencode', 'gemini']

  it.each(types)('renders an svg for %s', (agentType) => {
    const { container } = render(<AgentIcon agentType={agentType} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('defaults to size 16', () => {
    const { container } = render(<AgentIcon agentType="claude" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('16')
    expect(svg?.getAttribute('height')).toBe('16')
  })

  it('passes custom size', () => {
    const { container } = render(<AgentIcon agentType="copilot" size={24} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('24')
    expect(svg?.getAttribute('height')).toBe('24')
  })

  it('renders claude icon with correct fill color', () => {
    const { container } = render(<AgentIcon agentType="claude" />)
    const path = container.querySelector('path')
    expect(path?.getAttribute('fill')).toBe('#D97757')
  })
})
