// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Stubs that AgentCard reads at module load; installed before the import below.
vi.hoisted(() => {
  Object.defineProperty(window, 'api', {
    value: {
      isWorktreeDirty: () => Promise.resolve(false),
      getGitDiffStat: () => Promise.resolve(null),
      getGitBranch: () => Promise.resolve(null),
      notifyWidgetStatus: () => {}
    },
    writable: true
  })
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    writable: true
  })
})

const slotCalls: Array<{ terminalId: string; className?: string }> = []

vi.mock('../src/renderer/components/TerminalSlot', () => ({
  TerminalSlot: (props: { terminalId: string; className?: string }) => {
    slotCalls.push({ terminalId: props.terminalId, className: props.className })
    return <div data-testid={`slot-${props.terminalId}`} className={props.className} />
  }
}))

vi.mock('../src/renderer/hooks/useTerminalScrollButton', () => ({
  useTerminalScrollButton: () => ({ showScrollBtn: false, handleScrollToBottom: () => {} })
}))

import { useAppStore } from '../src/renderer/stores'
import { AgentCard } from '../src/renderer/components/AgentCard'

function seedTerminal(id: string) {
  const terminals = new Map()
  terminals.set(id, {
    id,
    session: {
      id,
      agentType: 'claude' as const,
      projectName: 'Vorn',
      projectPath: '/tmp/vorn',
      isWorktree: false,
      branch: 'main',
      createdAt: Date.now()
    },
    status: 'idle',
    lastOutputTimestamp: Date.now()
  })
  useAppStore.setState({
    terminals,
    focusedTerminalId: null,
    selectedTerminalId: null,
    renamingTerminalId: null,
    minimizedTerminals: new Set<string>()
  })
}

beforeEach(() => {
  slotCalls.length = 0
  seedTerminal('t1')
})

afterEach(() => cleanup())

describe('AgentCard TerminalSlot sizing', () => {
  it('uses w-full h-full in tab/grid mode', () => {
    render(<AgentCard terminalId="t1" />)
    const call = slotCalls.find((c) => c.terminalId === 't1')
    expect(call?.className).toBe('w-full h-full')
  })

  it('reserves 16px SE in flexible mode so the resize handle stays reachable', () => {
    render(<AgentCard terminalId="t1" flexible />)
    const call = slotCalls.find((c) => c.terminalId === 't1')
    expect(call?.className).toBe('absolute inset-0 right-4 bottom-4')
  })
})
