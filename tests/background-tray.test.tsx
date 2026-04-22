// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const toggle = vi.fn()
let collapsed = false
const mockState = {
  get backgroundTrayCollapsed() {
    return collapsed
  },
  toggleBackgroundTray: toggle
}
vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      backgroundTrayCollapsed: collapsed,
      toggleBackgroundTray: toggle,
      setEditingWorkflowId: vi.fn(),
      setWorkflowEditorOpen: vi.fn()
    }
    return selector ? selector(state) : state
  }
}))

vi.mock('../src/renderer/components/HeadlessPill', () => ({
  HeadlessPill: ({ session }: { session: { id: string } }) => (
    <div data-testid="headless-pill">{session.id}</div>
  )
}))
vi.mock('../src/renderer/components/MinimizedPill', () => ({
  MinimizedPill: ({ terminalId }: { terminalId: string }) => (
    <div data-testid="minimized-pill">{terminalId}</div>
  )
}))
vi.mock('../src/renderer/components/WaitingApprovalPill', () => ({
  WaitingApprovalPill: ({
    execution,
    nodeState
  }: {
    execution: { workflowId: string }
    nodeState: { nodeId: string }
  }) => (
    <div data-testid="waiting-pill">
      {execution.workflowId}:{nodeState.nodeId}
    </div>
  )
}))

import { BackgroundTray } from '../src/renderer/components/BackgroundTray'
import type { WaitingApproval } from '../src/renderer/components/BackgroundTray'
import type { HeadlessSession } from '../src/shared/types'

const _unused: unknown = mockState

function waiting(workflowId = 'wf-1', nodeId = 'n1'): WaitingApproval {
  return {
    execution: {
      workflowId,
      startedAt: '2026-04-20T10:00:00Z',
      status: 'running',
      nodeStates: [{ nodeId, status: 'waiting' }]
    },
    nodeState: { nodeId, status: 'waiting' }
  }
}

function headless(id: string): HeadlessSession {
  return {
    id,
    agentType: 'claude',
    projectName: 'p',
    projectPath: '/p',
    status: 'running',
    startedAt: '2026-04-20T10:00:00Z',
    prompt: '',
    logs: ''
  } as unknown as HeadlessSession
}

beforeEach(() => {
  toggle.mockReset()
  collapsed = false
})

describe('BackgroundTray', () => {
  it('returns null when there are no background items', () => {
    const { container } = render(
      <BackgroundTray
        headlessSessions={[]}
        minimizedIds={[]}
        waitingApprovals={[]}
        variant="grid"
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a waiting approval pill when gates are present', () => {
    const { getAllByTestId, container } = render(
      <BackgroundTray
        headlessSessions={[]}
        minimizedIds={[]}
        waitingApprovals={[waiting()]}
        variant="grid"
      />
    )
    expect(getAllByTestId('waiting-pill')).toHaveLength(1)
    expect(container.textContent).toContain('1 waiting approval')
  })

  it('uses plural phrasing for multiple waiting approvals', () => {
    const { container } = render(
      <BackgroundTray
        headlessSessions={[]}
        minimizedIds={[]}
        waitingApprovals={[waiting('a', 'n1'), waiting('b', 'n2')]}
        variant="grid"
      />
    )
    expect(container.textContent).toContain('2 waiting approvals')
  })

  it('renders headless and minimized pills alongside waiting', () => {
    const { getAllByTestId } = render(
      <BackgroundTray
        headlessSessions={[headless('h1')]}
        minimizedIds={['m1', 'm2']}
        waitingApprovals={[waiting()]}
        variant="tabs"
      />
    )
    expect(getAllByTestId('waiting-pill')).toHaveLength(1)
    expect(getAllByTestId('headless-pill')).toHaveLength(1)
    expect(getAllByTestId('minimized-pill')).toHaveLength(2)
  })

  it('shows group labels when multiple groups are present', () => {
    const { container } = render(
      <BackgroundTray
        headlessSessions={[headless('h1')]}
        minimizedIds={['m1']}
        waitingApprovals={[waiting()]}
        variant="grid"
      />
    )
    expect(container.textContent?.toLowerCase()).toContain('waiting approval')
    expect(container.textContent?.toLowerCase()).toContain('headless')
    expect(container.textContent?.toLowerCase()).toContain('minimized')
  })

  it('invokes toggle when the header button is clicked', () => {
    const { container } = render(
      <BackgroundTray
        headlessSessions={[]}
        minimizedIds={[]}
        waitingApprovals={[waiting()]}
        variant="grid"
      />
    )
    const header = container.querySelector('button[aria-label="Toggle background tray"]')!
    fireEvent.click(header)
    expect(toggle).toHaveBeenCalled()
  })

  it('hides group content when collapsed', () => {
    collapsed = true
    const { queryAllByTestId } = render(
      <BackgroundTray
        headlessSessions={[]}
        minimizedIds={[]}
        waitingApprovals={[waiting()]}
        variant="grid"
      />
    )
    expect(queryAllByTestId('waiting-pill')).toHaveLength(0)
  })

  it('prefers running count in the summary when at least one headless is running', () => {
    const { container } = render(
      <BackgroundTray
        headlessSessions={[headless('h1'), headless('h2')]}
        minimizedIds={[]}
        waitingApprovals={[]}
        variant="grid"
      />
    )
    expect(container.textContent).toContain('2 running')
  })

  it('falls back to headless count when none are running', () => {
    const idle = { ...headless('h1'), status: 'exited' } as HeadlessSession
    const { container } = render(
      <BackgroundTray
        headlessSessions={[idle]}
        minimizedIds={[]}
        waitingApprovals={[]}
        variant="grid"
      />
    )
    expect(container.textContent).toContain('1 headless')
  })
})
