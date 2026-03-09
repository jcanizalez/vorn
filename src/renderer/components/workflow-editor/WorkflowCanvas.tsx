import { useMemo } from 'react'
import { TriggerNode } from './nodes/TriggerNode'
import { LaunchAgentNode } from './nodes/LaunchAgentNode'
import { AddStepNode } from './nodes/AddStepNode'
import { WorkflowNode, WorkflowEdge, TriggerConfig, LaunchAgentConfig } from '../../../shared/types'

interface Props {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onNodeClick: (nodeId: string) => void
  onAddNodeAtEnd: () => void
  selectedNodeId: string | null
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodeClick,
  onAddNodeAtEnd,
  selectedNodeId
}: Props) {
  // Order nodes: trigger first, then BFS through edges
  const orderedNodes = useMemo(() => {
    const trigger = nodes.find((n) => n.type === 'trigger')
    if (!trigger) return nodes

    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const childrenMap = new Map<string, string[]>()
    for (const edge of edges) {
      const children = childrenMap.get(edge.source) || []
      children.push(edge.target)
      childrenMap.set(edge.source, children)
    }

    const ordered: WorkflowNode[] = [trigger]
    const visited = new Set([trigger.id])
    const queue = [trigger.id]

    while (queue.length > 0) {
      const current = queue.shift()!
      const children = childrenMap.get(current) || []
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId)
          queue.push(childId)
          const node = nodeMap.get(childId)
          if (node) ordered.push(node)
        }
      }
    }

    // Add any orphan nodes
    for (const node of nodes) {
      if (!visited.has(node.id)) ordered.push(node)
    }

    return ordered
  }, [nodes, edges])

  return (
    <div
      className="flex-1 h-full overflow-auto"
      onClick={() => onNodeClick('')}
    >
      <div className="flex flex-col items-center py-12 min-h-full">
        {orderedNodes.map((node, index) => (
          <div key={node.id} className="flex flex-col items-center">
            {/* Connector line before this node (except the first) */}
            {index > 0 && (
              <div className="w-px h-8 bg-white/[0.15]" />
            )}

            {/* Node card */}
            {node.type === 'trigger' ? (
              <TriggerNode
                label={node.label}
                config={node.config as TriggerConfig}
                selected={node.id === selectedNodeId}
                onClick={() => onNodeClick(node.id)}
              />
            ) : (
              <LaunchAgentNode
                label={node.label}
                config={node.config as LaunchAgentConfig}
                selected={node.id === selectedNodeId}
                onClick={() => onNodeClick(node.id)}
              />
            )}
          </div>
        ))}

        {/* Add Step button at end */}
        {nodes.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-px h-8 border-l border-dashed border-white/[0.12]" />
            <AddStepNode onAdd={onAddNodeAtEnd} />
          </div>
        )}
      </div>
    </div>
  )
}
