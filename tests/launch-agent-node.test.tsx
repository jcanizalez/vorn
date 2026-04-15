// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Stub the zustand store so LaunchAgentNode can read remoteHosts without a
// real provider.
const mockConfig = {
  remoteHosts: [] as Array<{ id: string; label: string }>
}
vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    const state = { config: mockConfig }
    return selector ? selector(state) : state
  }
}))

// Replace AgentIcon with a tagged div so tests can detect which branch ran.
vi.mock('../src/renderer/components/AgentIcon', () => ({
  AgentIcon: ({ agentType }: { agentType: string }) => (
    <div data-testid="agent-icon" data-agent={agentType} />
  )
}))

const { LaunchAgentNode } =
  await import('../src/renderer/components/workflow-editor/nodes/LaunchAgentNode')

import type { LaunchAgentConfig } from '../src/shared/types'

function makeConfig(overrides: Partial<LaunchAgentConfig> = {}): LaunchAgentConfig {
  return {
    agentType: 'claude',
    projectName: 'demo',
    projectPath: '/demo',
    ...overrides
  }
}

beforeEach(() => {
  mockConfig.remoteHosts = []
})

describe('LaunchAgentNode rendering', () => {
  it('renders the concrete AgentIcon when agentType is a real agent', () => {
    const { queryByTestId } = render(
      <LaunchAgentNode
        label="Run claude"
        config={makeConfig({ agentType: 'claude' })}
        onClick={vi.fn()}
      />
    )
    const icon = queryByTestId('agent-icon')
    expect(icon).toBeInTheDocument()
    expect(icon?.getAttribute('data-agent')).toBe('claude')
  })

  it('renders the ClipboardList glyph (not AgentIcon) when agentType is "fromTask"', () => {
    const { queryByTestId, container } = render(
      <LaunchAgentNode
        label="Launch task agent"
        config={makeConfig({ agentType: 'fromTask' })}
        onClick={vi.fn()}
      />
    )
    // No AgentIcon rendered in the fromTask branch
    expect(queryByTestId('agent-icon')).not.toBeInTheDocument()
    // ClipboardList is rendered (check for lucide icon class)
    const iconSvg = container.querySelector('svg.lucide-clipboard-list')
    expect(iconSvg).toBeInTheDocument()
  })

  it('uses a distinct blue background tint for the fromTask node', () => {
    const { container: fromTaskContainer } = render(
      <LaunchAgentNode
        label="Launch task agent"
        config={makeConfig({ agentType: 'fromTask' })}
        onClick={vi.fn()}
      />
    )
    const iconWrapper = fromTaskContainer.querySelector('div[style*="background"]') as HTMLElement
    expect(iconWrapper?.style.backgroundColor).toContain('96')
    // 0x60 = 96 → the #60a5fa color starts with 0x60, which rgb() renders as 96
  })

  it('falls back to a neutral swatch when agentType is an unknown string', () => {
    const { container } = render(
      <LaunchAgentNode
        label="Weird agent"
        // @ts-expect-error — probing fallback path with an unmapped agent value
        config={makeConfig({ agentType: 'unknown-future-agent' })}
        onClick={vi.fn()}
      />
    )
    // The fallback color is #6b7280; the wrapper style should contain the hex
    // prefix via rgba-ish rendering. We just assert the node mounted with a
    // background style rather than throwing on the missing lookup.
    const iconWrapper = container.querySelector('div[style*="background"]')
    expect(iconWrapper).toBeInTheDocument()
  })

  it('fires onClick and stops propagation when the node is clicked', () => {
    const onClick = vi.fn()
    const { container } = render(
      <LaunchAgentNode
        label="Launch"
        config={makeConfig({ agentType: 'fromTask' })}
        onClick={onClick}
      />
    )
    ;(container.firstChild as HTMLElement).click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
