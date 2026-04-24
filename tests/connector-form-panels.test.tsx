// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type {
  ConnectorPollTriggerConfig,
  CallConnectorActionConfig,
  CreateTaskFromItemConfig,
  SourceConnection,
  ConnectorManifest
} from '../src/shared/types'

// Zustand store stub: projects for CreateTaskFromItemNodeForm.
vi.mock('../src/renderer/stores', () => ({
  useAppStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      config: {
        projects: [
          { name: 'vorn', path: '/dev/vorn', preferredAgents: [] },
          { name: 'other', path: '/dev/other', preferredAgents: [] }
        ],
        remoteHosts: []
      }
    }
    return selector ? selector(state) : state
  }
}))

const listConnectorsMock = vi.fn()
const listConnectionsMock = vi.fn()

beforeEach(() => {
  listConnectorsMock.mockReset()
  listConnectionsMock.mockReset()
  listConnectorsMock.mockResolvedValue([])
  listConnectionsMock.mockResolvedValue([])
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      listConnectors: listConnectorsMock,
      listConnections: listConnectionsMock
    }
  })
})

const GITHUB_MANIFEST: ConnectorManifest = {
  auth: [],
  triggers: [
    { type: 'issueCreated', label: 'Issue Created', configFields: [], defaultIntervalMs: 60_000 }
  ],
  actions: [
    {
      type: 'commentOnIssue',
      label: 'Comment on Issue',
      description: 'Post a comment',
      configFields: [
        { key: 'number', label: 'Issue #', type: 'text', required: true },
        { key: 'body', label: 'Comment', type: 'textarea', required: true }
      ]
    }
  ]
}

const CONN: SourceConnection = {
  id: 'conn-1',
  connectorId: 'github',
  name: 'owner/repo',
  filters: {},
  syncIntervalMinutes: 5,
  statusMapping: {},
  createdAt: '2026-04-24T00:00:00Z'
}

import { CreateTaskFromItemNodeForm } from '../src/renderer/components/workflow-editor/panels/CreateTaskFromItemNodeForm'
import { ConnectorPollTriggerForm } from '../src/renderer/components/workflow-editor/panels/ConnectorPollTriggerForm'
import { CallConnectorActionNodeForm } from '../src/renderer/components/workflow-editor/panels/CallConnectorActionNodeForm'

describe('CreateTaskFromItemNodeForm', () => {
  const baseConfig: CreateTaskFromItemConfig = {
    nodeType: 'createTaskFromItem',
    project: 'fromConnection',
    initialStatus: 'todo'
  }

  it('renders Project and Initial Status labels', () => {
    const { getByText } = render(
      <CreateTaskFromItemNodeForm config={baseConfig} onChange={() => {}} />
    )
    expect(getByText('Project')).toBeInTheDocument()
    expect(getByText('Initial Status')).toBeInTheDocument()
  })

  it('shows the executionProject helper note for fromConnection', () => {
    const { container } = render(
      <CreateTaskFromItemNodeForm config={baseConfig} onChange={() => {}} />
    )
    expect(container.textContent).toContain('executionProject')
  })

  it('shows the re-sync note under initial status', () => {
    const { container } = render(
      <CreateTaskFromItemNodeForm config={baseConfig} onChange={() => {}} />
    )
    expect(container.textContent).toContain('Local status edits are never overwritten')
  })
})

describe('ConnectorPollTriggerForm', () => {
  const baseConfig: ConnectorPollTriggerConfig = {
    triggerType: 'connectorPoll',
    connectionId: '',
    event: '',
    cron: '*/5 * * * *'
  }

  it('shows the empty-state message when no connections exist', async () => {
    const { getByText } = render(
      <ConnectorPollTriggerForm config={baseConfig} onChange={() => {}} />
    )
    await waitFor(() => {
      expect(getByText(/No connections yet/)).toBeInTheDocument()
    })
  })

  it('renders the cron input and the min/hour/day helper', async () => {
    const { getByPlaceholderText, getByText } = render(
      <ConnectorPollTriggerForm config={baseConfig} onChange={() => {}} />
    )
    expect(getByPlaceholderText('*/5 * * * *')).toBeInTheDocument()
    expect(getByText(/min hour day month weekday/)).toBeInTheDocument()
  })

  it('fires onChange when the cron input is edited', async () => {
    const onChange = vi.fn()
    const { getByPlaceholderText } = render(
      <ConnectorPollTriggerForm config={baseConfig} onChange={onChange} />
    )
    fireEvent.change(getByPlaceholderText('*/5 * * * *'), { target: { value: '0 * * * *' } })
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cron: '0 * * * *', triggerType: 'connectorPoll' })
    )
  })

  it('renders the Event select only once a connection is selected', async () => {
    listConnectionsMock.mockResolvedValue([CONN])
    listConnectorsMock.mockResolvedValue([
      { id: 'github', name: 'GitHub', icon: 'github', capabilities: [], manifest: GITHUB_MANIFEST }
    ])
    const { queryByText, rerender, getByText } = render(
      <ConnectorPollTriggerForm config={baseConfig} onChange={() => {}} />
    )
    // Before a connection is chosen, the Event section is hidden.
    await waitFor(() => {
      expect(queryByText('Event')).toBeNull()
    })
    rerender(
      <ConnectorPollTriggerForm
        config={{ ...baseConfig, connectionId: 'conn-1' }}
        onChange={() => {}}
      />
    )
    await waitFor(() => {
      expect(getByText('Event')).toBeInTheDocument()
    })
  })
})

describe('CallConnectorActionNodeForm', () => {
  const baseConfig: CallConnectorActionConfig = {
    nodeType: 'callConnectorAction',
    connectionId: '',
    action: '',
    args: {}
  }

  it('shows the empty-state message when no connections exist', async () => {
    const { getByText } = render(
      <CallConnectorActionNodeForm config={baseConfig} onChange={() => {}} />
    )
    await waitFor(() => {
      expect(getByText(/No connections yet/)).toBeInTheDocument()
    })
  })

  it('renders the Connection label', () => {
    const { getByText } = render(
      <CallConnectorActionNodeForm config={baseConfig} onChange={() => {}} />
    )
    expect(getByText('Connection')).toBeInTheDocument()
  })

  it('renders argument inputs for the selected action', async () => {
    listConnectionsMock.mockResolvedValue([CONN])
    listConnectorsMock.mockResolvedValue([
      { id: 'github', name: 'GitHub', icon: 'github', capabilities: [], manifest: GITHUB_MANIFEST }
    ])
    const config: CallConnectorActionConfig = {
      ...baseConfig,
      connectionId: 'conn-1',
      action: 'commentOnIssue'
    }
    const { findByText } = render(
      <CallConnectorActionNodeForm config={config} onChange={() => {}} />
    )
    expect(await findByText('Issue #')).toBeInTheDocument()
    expect(await findByText('Comment')).toBeInTheDocument()
  })

  it('calls onChange when an argument value is edited', async () => {
    listConnectionsMock.mockResolvedValue([CONN])
    listConnectorsMock.mockResolvedValue([
      { id: 'github', name: 'GitHub', icon: 'github', capabilities: [], manifest: GITHUB_MANIFEST }
    ])
    const onChange = vi.fn()
    const { findByText, container } = render(
      <CallConnectorActionNodeForm
        config={{ ...baseConfig, connectionId: 'conn-1', action: 'commentOnIssue' }}
        onChange={onChange}
      />
    )
    await findByText('Issue #')
    const issueNumberInput = container.querySelectorAll('input')[0]
    fireEvent.change(issueNumberInput, { target: { value: '42' } })
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.args.number).toBe('42')
  })
})
