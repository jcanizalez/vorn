import { useMemo, Fragment } from 'react'
import { TriggerNode } from './nodes/TriggerNode'
import { LaunchAgentNode } from './nodes/LaunchAgentNode'
import { ScriptNode } from './nodes/ScriptNode'
import { ConnectorButton } from './nodes/AddStepNode'
import {
  WorkflowNode,
  WorkflowEdge,
  TriggerConfig,
  LaunchAgentConfig,
  ScriptConfig
} from '../../../shared/types'
import { computeFlowLayout, FlowRow } from '../../lib/workflow-helpers'

interface Props {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onNodeClick: (nodeId: string) => void
  onInsertNode: (
    afterNodeId: string,
    beforeNodeId: string | null,
    type: 'agent' | 'script'
  ) => void
  onAddParallelBranch: (forkFromId: string, type: 'agent' | 'script') => void
  selectedNodeId: string | null
}

function VerticalLine({ dashed, height }: { dashed?: boolean; height?: number }) {
  return (
    <div
      className={`w-px shrink-0 ${
        dashed ? 'border-l border-dashed border-white/[0.12]' : 'bg-white/[0.15]'
      }`}
      style={{ height: height ?? 24 }}
    />
  )
}

function NodeCard({
  node,
  selected,
  onClick
}: {
  node: WorkflowNode
  selected: boolean
  onClick: () => void
}) {
  if (node.type === 'trigger') {
    return (
      <TriggerNode
        label={node.label}
        config={node.config as TriggerConfig}
        selected={selected}
        onClick={onClick}
      />
    )
  }

  if (node.type === 'script') {
    return (
      <ScriptNode
        label={node.label}
        config={node.config as ScriptConfig}
        selected={selected}
        onClick={onClick}
      />
    )
  }

  return (
    <LaunchAgentNode
      label={node.label}
      config={node.config as LaunchAgentConfig}
      selected={selected}
      onClick={onClick}
    />
  )
}

function FlowRowRenderer({
  rows,
  onNodeClick,
  onInsertNode,
  onAddParallelBranch,
  selectedNodeId,
  isInsideBranch
}: {
  rows: FlowRow[]
  onNodeClick: (nodeId: string) => void
  onInsertNode: (
    afterNodeId: string,
    beforeNodeId: string | null,
    type: 'agent' | 'script'
  ) => void
  onAddParallelBranch: (forkFromId: string, type: 'agent' | 'script') => void
  selectedNodeId: string | null
  isInsideBranch?: boolean
}) {
  return (
    <>
      {rows.map((row, i) => {
        if (row.kind === 'node') {
          const nextRow = rows[i + 1]
          const isLast = i === rows.length - 1
          const nextIsFork = nextRow?.kind === 'fork'

          let beforeNodeId: string | null = null
          if (nextIsFork) {
            beforeNodeId = '__FORK__'
          } else if (nextRow?.kind === 'node') {
            beforeNodeId = nextRow.node.id
          }

          return (
            <Fragment key={row.node.id}>
              {i > 0 && <VerticalLine />}

              <NodeCard
                node={row.node}
                selected={row.node.id === selectedNodeId}
                onClick={() => onNodeClick(row.node.id)}
              />

              {!isLast && (
                <>
                  <VerticalLine />
                  <ConnectorButton
                    onAddAction={() => onInsertNode(row.node.id, beforeNodeId, 'agent')}
                    onAddScript={() => onInsertNode(row.node.id, beforeNodeId, 'script')}
                    onAddParallelBranch={() => onAddParallelBranch(row.node.id, 'agent')}
                  />
                </>
              )}

              {isLast && (
                <>
                  <VerticalLine dashed />
                  <ConnectorButton
                    onAddAction={() => onInsertNode(row.node.id, null, 'agent')}
                    onAddScript={() => onInsertNode(row.node.id, null, 'script')}
                    onAddParallelBranch={
                      !isInsideBranch
                        ? () => onAddParallelBranch(row.node.id, 'agent')
                        : undefined
                    }
                  />
                </>
              )}
            </Fragment>
          )
        }

        return (
          <ForkRenderer
            key={`fork-${row.forkNodeId}`}
            row={row}
            onNodeClick={onNodeClick}
            onInsertNode={onInsertNode}
            onAddParallelBranch={onAddParallelBranch}
            selectedNodeId={selectedNodeId}
          />
        )
      })}
    </>
  )
}

function HorizontalBar({ branchCount }: { branchCount: number }) {
  return (
    <div className="flex w-full">
      {Array.from({ length: branchCount }, (_, i) => (
        <div key={i} className="flex-1 relative h-px">
          {i > 0 && (
            <div className="absolute left-0 right-1/2 top-0 h-px bg-white/[0.15]" />
          )}
          {i < branchCount - 1 && (
            <div className="absolute left-1/2 right-0 top-0 h-px bg-white/[0.15]" />
          )}
        </div>
      ))}
    </div>
  )
}

function ForkRenderer({
  row,
  onNodeClick,
  onInsertNode,
  onAddParallelBranch,
  selectedNodeId
}: {
  row: Extract<FlowRow, { kind: 'fork' }>
  onNodeClick: (nodeId: string) => void
  onInsertNode: (
    afterNodeId: string,
    beforeNodeId: string | null,
    type: 'agent' | 'script'
  ) => void
  onAddParallelBranch: (forkFromId: string, type: 'agent' | 'script') => void
  selectedNodeId: string | null
}) {
  const branchCount = row.branches.length

  return (
    <div className="flex flex-col items-center w-full">
      <HorizontalBar branchCount={branchCount} />

      <div className="flex w-full">
        {row.branches.map((branch, bi) => {
          const branchKey =
            branch[0]?.kind === 'node' ? branch[0].node.id : `branch-${bi}`

          return (
            <div
              key={branchKey}
              className="flex flex-col items-center flex-1"
              style={{ minWidth: 310 }}
            >
              <VerticalLine />

              <FlowRowRenderer
                rows={branch}
                onNodeClick={onNodeClick}
                onInsertNode={onInsertNode}
                onAddParallelBranch={onAddParallelBranch}
                selectedNodeId={selectedNodeId}
                isInsideBranch
              />

              {row.joinNodeId && <VerticalLine />}
            </div>
          )
        })}
      </div>

      {row.joinNodeId && <HorizontalBar branchCount={branchCount} />}
    </div>
  )
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodeClick,
  onInsertNode,
  onAddParallelBranch,
  selectedNodeId
}: Props) {
  const flowLayout = useMemo(() => computeFlowLayout(nodes, edges), [nodes, edges])

  return (
    <div className="flex-1 h-full overflow-auto" onClick={() => onNodeClick('')}>
      <div className="flex flex-col items-center py-12 min-h-full px-8">
        <FlowRowRenderer
          rows={flowLayout}
          onNodeClick={onNodeClick}
          onInsertNode={onInsertNode}
          onAddParallelBranch={onAddParallelBranch}
          selectedNodeId={selectedNodeId}
        />
      </div>
    </div>
  )
}
