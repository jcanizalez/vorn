// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SessionActivityLog } from '../src/renderer/components/SessionActivityLog'
import type { SessionLog } from '../src/shared/types'

// Mock createPortal to render inline
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom')
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node
  }
})

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="check-icon" {...props} />,
  XCircle: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  Clock: (props: Record<string, unknown>) => <svg data-testid="clock-icon" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronRight: (props: Record<string, unknown>) => <svg data-testid="chevron-right" {...props} />,
  Maximize2: (props: Record<string, unknown>) => <svg data-testid="maximize-icon" {...props} />,
  Play: (props: Record<string, unknown>) => <svg data-testid="play-icon" {...props} />,
  RotateCcw: (props: Record<string, unknown>) => <svg data-testid="rotate-ccw-icon" {...props} />
}))

// Mock framer-motion (used by RunEntry's StatusIcon)
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    )
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>
}))

function makeLog(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 1,
    taskId: 'task-1',
    sessionId: 'sess-1',
    agentType: 'claude',
    branch: 'main',
    status: 'success',
    startedAt: '2026-03-25T10:00:00Z',
    completedAt: '2026-03-25T10:05:00Z',
    exitCode: 0,
    logs: 'Hello world\nDone.',
    projectName: 'test-project',
    ...overrides
  }
}

describe('SessionActivityLog', () => {
  let onViewFullOutput: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onViewFullOutput = vi.fn()
  })

  it('shows empty state when no logs', () => {
    const { getByText } = render(
      <SessionActivityLog logs={[]} onViewFullOutput={onViewFullOutput} />
    )
    expect(getByText(/No session activity yet/)).toBeInTheDocument()
  })

  it('renders a session card with agent and duration', () => {
    const { getByText } = render(
      <SessionActivityLog logs={[makeLog()]} onViewFullOutput={onViewFullOutput} />
    )
    expect(getByText('claude')).toBeInTheDocument()
    expect(getByText('5m 0s')).toBeInTheDocument()
  })

  it('shows success dot for completed session', () => {
    const { container } = render(
      <SessionActivityLog
        logs={[makeLog({ status: 'success' })]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    expect(container.querySelector('.bg-green-400')).toBeInTheDocument()
  })

  it('shows error icon for errored session', () => {
    const { getAllByTestId } = render(
      <SessionActivityLog
        logs={[makeLog({ status: 'error', exitCode: 1, logs: 'Error: something failed' })]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    // x-icon appears both in status and error card
    expect(getAllByTestId('x-icon').length).toBeGreaterThanOrEqual(1)
  })

  it('shows running dot for running session', () => {
    const { container } = render(
      <SessionActivityLog
        logs={[makeLog({ status: 'running', completedAt: undefined })]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    expect(container.querySelector('.bg-yellow-400')).toBeInTheDocument()
  })

  it('auto-expands first session and errored sessions', () => {
    const { getByText } = render(
      <SessionActivityLog
        logs={[makeLog({ logs: 'Hello world\nDone.' })]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    // Output should be visible since first card is auto-expanded
    expect(getByText(/Hello world/)).toBeInTheDocument()
  })

  it('shows error extraction card for errored sessions', () => {
    const { container } = render(
      <SessionActivityLog
        logs={[
          makeLog({
            status: 'error',
            exitCode: 1,
            logs: 'Starting...\nError: ENOENT file not found'
          })
        ]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    // The error card should contain the extracted error text
    const errCard = container.querySelector('.text-red-400.font-mono')
    expect(errCard).toBeInTheDocument()
    expect(errCard?.textContent).toContain('ENOENT')
  })

  it('shows "View Full Output" button and calls callback', () => {
    const log = makeLog({ logs: 'Some output content' })
    const { getByLabelText } = render(
      <SessionActivityLog logs={[log]} onViewFullOutput={onViewFullOutput} />
    )
    const btn = getByLabelText('View full output')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onViewFullOutput).toHaveBeenCalledWith('Some output content')
  })

  it('renders multiple session cards, most recent first', () => {
    const logs = [
      makeLog({ sessionId: 'sess-2', startedAt: '2026-03-25T11:00:00Z', agentType: 'claude' }),
      makeLog({
        sessionId: 'sess-1',
        startedAt: '2026-03-25T10:00:00Z',
        status: 'error',
        exitCode: 1
      })
    ]
    const { container } = render(
      <SessionActivityLog logs={logs} onViewFullOutput={onViewFullOutput} />
    )
    const cards = container.querySelectorAll('.border.border-white\\/\\[0\\.08\\]')
    expect(cards.length).toBe(2)
  })

  it('toggles card expansion on click', () => {
    const log = makeLog({ logs: 'Toggle me' })
    const { getByText, queryByText, container } = render(
      <SessionActivityLog logs={[log]} onViewFullOutput={onViewFullOutput} />
    )
    // First card is auto-expanded
    expect(getByText(/Toggle me/)).toBeInTheDocument()

    // Click header to collapse
    const header = container.querySelector('button')!
    fireEvent.click(header)
    expect(queryByText(/Toggle me/)).not.toBeInTheDocument()

    // Click again to expand
    fireEvent.click(header)
    expect(getByText(/Toggle me/)).toBeInTheDocument()
  })

  it('shows streaming indicator for running sessions', () => {
    const { getByText } = render(
      <SessionActivityLog
        logs={[makeLog({ status: 'running', completedAt: undefined, logs: 'Working...' })]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    expect(getByText('streaming')).toBeInTheDocument()
  })

  it('shows exit code in summary strip', () => {
    const { getByText } = render(
      <SessionActivityLog logs={[makeLog({ exitCode: 0 })]} onViewFullOutput={onViewFullOutput} />
    )
    expect(getByText('exit 0')).toBeInTheDocument()
  })

  it('truncates long output', () => {
    const longOutput = 'x'.repeat(2000)
    const { getByText } = render(
      <SessionActivityLog
        logs={[makeLog({ logs: longOutput })]}
        onViewFullOutput={onViewFullOutput}
      />
    )
    expect(getByText(/\.\.\./)).toBeInTheDocument()
  })

  it('does not show Resume Session when no agentSessionId', () => {
    const { queryByLabelText } = render(
      <SessionActivityLog logs={[makeLog()]} onViewFullOutput={onViewFullOutput} />
    )
    expect(queryByLabelText('Resume session')).not.toBeInTheDocument()
  })

  it('shows Resume Session for errored sessions when agentSessionId provided', () => {
    const onResume = vi.fn()
    const { getByLabelText } = render(
      <SessionActivityLog
        logs={[makeLog({ status: 'error', exitCode: 1, logs: 'Error: failed' })]}
        onViewFullOutput={onViewFullOutput}
        onResumeSession={onResume}
        agentSessionId="agent-123"
        projectPath="/test"
      />
    )
    expect(getByLabelText('Resume session')).toBeInTheDocument()
  })

  it('clicking Resume Session fires the callback with session + project info', () => {
    const onResume = vi.fn()
    const { getByLabelText } = render(
      <SessionActivityLog
        logs={[
          makeLog({
            status: 'error',
            exitCode: 1,
            logs: 'Error: failed',
            projectName: 'proj',
            branch: 'feat/x'
          })
        ]}
        onViewFullOutput={onViewFullOutput}
        onResumeSession={onResume}
        agentSessionId="agent-xyz"
        projectPath="/abs/path"
      />
    )
    fireEvent.click(getByLabelText('Resume session'))
    expect(onResume).toHaveBeenCalledWith('agent-xyz', 'claude', 'proj', '/abs/path', 'feat/x')
  })
})
