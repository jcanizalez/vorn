// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

Object.defineProperty(window, 'matchMedia', {
  value: () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }),
  writable: true
})

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) =>
          React.createElement(tag, { ...props, ref })
        )
    }
  )
}))

const mockLoading = vi.fn(() => 'toast-id')
const mockUpdate = vi.fn()
const mockToastError = vi.fn()

vi.mock('../src/renderer/components/Toast', () => ({
  toast: Object.assign(
    (msg: string) => {
      mockLoading(msg)
      return 'toast-id'
    },
    {
      loading: (msg: string) => mockLoading(msg),
      update: (id: string, msg: string, type: string) => mockUpdate(id, msg, type),
      dismiss: vi.fn(),
      success: vi.fn(),
      error: (msg: string) => mockToastError(msg),
      warning: vi.fn(),
      info: vi.fn()
    }
  )
}))

const mockCreateSession = vi.fn()
const mockCreateShell = vi.fn().mockResolvedValue(undefined)

vi.mock('../src/renderer/lib/session-utils', () => ({
  createSessionFromProject: (...args: unknown[]) => mockCreateSession(...args),
  createShellInProject: (...args: unknown[]) => mockCreateShell(...args)
}))

const mockRequestWorktreeDelete = vi.fn()

vi.mock('../src/renderer/components/WorktreeCleanupDialog', () => ({
  requestWorktreeDelete: (info: unknown) => mockRequestWorktreeDelete(info),
  WorktreeCleanupDialog: () => null
}))

const mockGetActiveSessions = vi.fn()
const mockRemoveWorktree = vi.fn()

Object.defineProperty(window, 'api', {
  value: {
    getWorktreeActiveSessions: (...a: unknown[]) => mockGetActiveSessions(...a),
    removeWorktree: (...a: unknown[]) => mockRemoveWorktree(...a),
    renameWorktree: vi.fn()
  },
  writable: true
})

import { useAppStore } from '../src/renderer/stores'
import { WorktreeItem } from '../src/renderer/components/project-sidebar/WorktreeItem'
import type { ProjectConfig, AppConfig } from '../src/shared/types'
import type { WorktreeInfo } from '../src/renderer/stores/types'

const project: ProjectConfig = {
  name: 'test-proj',
  path: '/tmp/test-proj'
}

const worktree: WorktreeInfo = {
  path: '/tmp/test-proj/wt-a',
  branch: 'feature-a',
  name: 'feature-a',
  isMain: false,
  isDirty: false
}

const baseConfig: Partial<AppConfig> = {
  projects: [project],
  defaults: { defaultAgent: 'claude' } as AppConfig['defaults'],
  remoteHosts: []
}

const initialState = useAppStore.getState()

function renderWorktreeItem(wt: WorktreeInfo = worktree, onWorktreesChanged: () => void = vi.fn()) {
  return render(
    <WorktreeItem
      worktree={wt}
      projectPath={project.path}
      projectName={project.name}
      isActiveWorktree={false}
      sessionCount={0}
      onSelect={vi.fn()}
      onWorktreesChanged={onWorktreesChanged}
    />
  )
}

describe('WorktreeItem progress-toast handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSession.mockResolvedValue(undefined)
    mockGetActiveSessions.mockResolvedValue({ count: 0, sessionIds: [] })
    mockRemoveWorktree.mockResolvedValue(true)
    useAppStore.setState({ config: baseConfig as AppConfig })
  })

  afterEach(() => {
    useAppStore.setState(initialState)
  })

  it('new session button fires loading toast and calls createSessionFromProject', async () => {
    const { container } = renderWorktreeItem()
    const sessionBtn = container.querySelector('button[aria-label="New session"]') as HTMLElement
    act(() => {
      fireEvent.click(sessionBtn)
    })
    expect(mockLoading).toHaveBeenCalledWith('Starting session…')
    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(project, {
        branch: 'feature-a',
        existingWorktreePath: '/tmp/test-proj/wt-a'
      })
      expect(mockUpdate).toHaveBeenCalledWith('toast-id', 'Session started', 'success')
    })
  })

  it('new terminal button calls createShellInProject with worktree path', async () => {
    const { container } = renderWorktreeItem()
    const terminalBtn = container.querySelector('button[aria-label="New terminal"]') as HTMLElement
    expect(terminalBtn).not.toBeNull()
    act(() => {
      fireEvent.click(terminalBtn)
    })
    await waitFor(() => {
      expect(mockCreateShell).toHaveBeenCalledWith(worktree.path)
    })
  })

  it('new terminal ref-lock prevents synchronous double-click from firing twice', async () => {
    let resolveIt: () => void
    mockCreateShell.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveIt = resolve
        })
    )
    const { container } = renderWorktreeItem()
    const terminalBtn = container.querySelector('button[aria-label="New terminal"]') as HTMLElement
    act(() => {
      fireEvent.click(terminalBtn)
      fireEvent.click(terminalBtn)
    })
    expect(mockCreateShell).toHaveBeenCalledTimes(1)
    act(() => resolveIt!())
  })

  it('new session ref-lock prevents a synchronous double-click from firing twice', async () => {
    let resolveIt: () => void
    mockCreateSession.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveIt = resolve
        })
    )
    const { container } = renderWorktreeItem()
    const sessionBtn = container.querySelector('button[aria-label="New session"]') as HTMLElement
    act(() => {
      fireEvent.click(sessionBtn)
      fireEvent.click(sessionBtn)
    })
    expect(mockCreateSession).toHaveBeenCalledTimes(1)
    act(() => resolveIt!())
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
  })

  it('remove button takes the fast path when worktree is clean and has no sessions', async () => {
    const onWorktreesChanged = vi.fn()
    const { container } = renderWorktreeItem(worktree, onWorktreesChanged)
    const buttons = Array.from(container.querySelectorAll('button[type="button"]'))
    const removeBtn = buttons[buttons.length - 1]
    act(() => {
      fireEvent.click(removeBtn)
    })
    await waitFor(() => {
      expect(mockGetActiveSessions).toHaveBeenCalledWith(worktree.path)
    })
    await waitFor(() => {
      expect(mockLoading).toHaveBeenCalledWith('Removing worktree…')
      expect(mockRemoveWorktree).toHaveBeenCalledWith(project.path, worktree.path, false)
      expect(onWorktreesChanged).toHaveBeenCalled()
      expect(mockUpdate).toHaveBeenCalledWith('toast-id', 'Worktree removed', 'success')
    })
  })

  it('remove button routes through cleanup dialog when worktree has active sessions', async () => {
    mockGetActiveSessions.mockResolvedValue({ count: 2, sessionIds: ['s1', 's2'] })
    const { container } = renderWorktreeItem()
    const buttons = Array.from(container.querySelectorAll('button[type="button"]'))
    const removeBtn = buttons[buttons.length - 1]
    act(() => {
      fireEvent.click(removeBtn)
    })
    await waitFor(() => {
      expect(mockRequestWorktreeDelete).toHaveBeenCalledWith({
        projectPath: project.path,
        worktreePath: worktree.path,
        sessionIds: ['s1', 's2']
      })
    })
    // Fast path should NOT run
    expect(mockRemoveWorktree).not.toHaveBeenCalled()
    expect(mockLoading).not.toHaveBeenCalledWith('Removing worktree…')
  })

  it('remove button routes through cleanup dialog when worktree is dirty', async () => {
    const dirty: WorktreeInfo = { ...worktree, isDirty: true }
    const { container } = renderWorktreeItem(dirty)
    const buttons = Array.from(container.querySelectorAll('button[type="button"]'))
    const removeBtn = buttons[buttons.length - 1]
    act(() => {
      fireEvent.click(removeBtn)
    })
    await waitFor(() => {
      expect(mockRequestWorktreeDelete).toHaveBeenCalled()
    })
    expect(mockRemoveWorktree).not.toHaveBeenCalled()
  })

  it('remove fast path transitions toast to error when removeWorktree returns false', async () => {
    mockRemoveWorktree.mockResolvedValue(false)
    const { container } = renderWorktreeItem()
    const buttons = Array.from(container.querySelectorAll('button[type="button"]'))
    const removeBtn = buttons[buttons.length - 1]
    act(() => {
      fireEvent.click(removeBtn)
    })
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('toast-id', 'Failed to remove worktree', 'error')
    })
  })
})
