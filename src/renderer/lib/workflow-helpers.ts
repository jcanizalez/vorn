import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  TriggerConfig,
  LaunchAgentConfig,
  WorkflowNodePosition
} from '../../shared/types'

/**
 * Extract the trigger node's config from a workflow definition.
 */
export function getTriggerConfig(wf: WorkflowDefinition): TriggerConfig | null {
  const triggerNode = wf.nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return null
  return triggerNode.config as TriggerConfig
}

/**
 * Get the trigger node from a workflow definition.
 */
export function getTriggerNode(wf: WorkflowDefinition): WorkflowNode | undefined {
  return wf.nodes.find((n) => n.type === 'trigger')
}

/**
 * Get action nodes in topological (execution) order.
 * Returns nodes after the trigger, following edge order.
 */
export function getOrderedActionNodes(wf: WorkflowDefinition): WorkflowNode[] {
  const triggerNode = getTriggerNode(wf)
  if (!triggerNode) return []

  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]))
  const childrenMap = new Map<string, string[]>()
  for (const edge of wf.edges) {
    const children = childrenMap.get(edge.source) || []
    children.push(edge.target)
    childrenMap.set(edge.source, children)
  }

  // BFS from trigger node
  const ordered: WorkflowNode[] = []
  const visited = new Set<string>()
  const queue = [triggerNode.id]
  visited.add(triggerNode.id)

  while (queue.length > 0) {
    const current = queue.shift()!
    const node = nodeMap.get(current)
    if (node && node.type !== 'trigger') {
      ordered.push(node)
    }
    const children = childrenMap.get(current) || []
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId)
        queue.push(childId)
      }
    }
  }

  return ordered
}

/**
 * Get the count of launch agent actions in a workflow.
 */
export function getActionCount(wf: WorkflowDefinition): number {
  return wf.nodes.filter((n) => n.type === 'launchAgent').length
}

/**
 * Check if a workflow has a scheduled trigger (not manual).
 */
export function isScheduledWorkflow(wf: WorkflowDefinition): boolean {
  const trigger = getTriggerConfig(wf)
  return trigger != null && trigger.triggerType !== 'manual'
}

/**
 * Get a human-readable label for the trigger type.
 */
export function getTriggerLabel(wf: WorkflowDefinition): string | undefined {
  const trigger = getTriggerConfig(wf)
  if (!trigger) return undefined
  if (trigger.triggerType === 'once') return 'once'
  if (trigger.triggerType === 'recurring') return 'recurring'
  if (trigger.triggerType === 'taskCreated') return 'on task created'
  if (trigger.triggerType === 'taskStatusChanged') return 'on status change'
  return undefined
}

/**
 * Create a default trigger node.
 */
export function createTriggerNode(config: TriggerConfig = { triggerType: 'manual' }): WorkflowNode {
  const labelMap: Record<string, string> = {
    manual: 'Manual Trigger',
    once: 'Schedule (Once)',
    recurring: 'Schedule (Recurring)',
    taskCreated: 'When Task Created',
    taskStatusChanged: 'When Task Status Changes'
  }
  return {
    id: crypto.randomUUID(),
    type: 'trigger',
    label: labelMap[config.triggerType] || 'Trigger',
    config,
    position: { x: 0, y: 0 }
  }
}

/**
 * Create a default launch agent node.
 */
export function createLaunchAgentNode(config: Partial<LaunchAgentConfig> = {}): WorkflowNode {
  return {
    id: crypto.randomUUID(),
    type: 'launchAgent',
    label: 'Launch Agent',
    config: {
      agentType: 'claude',
      projectName: '',
      projectPath: '',
      ...config
    } as LaunchAgentConfig,
    position: { x: 0, y: 0 }
  }
}

/**
 * Auto-layout nodes in a vertical (top-to-bottom) arrangement.
 * Simple layout without dagre dependency for basic cases.
 */
export function autoLayoutNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  if (nodes.length === 0) return nodes

  const triggerNode = nodes.find((n) => n.type === 'trigger')
  const ordered = triggerNode ? [triggerNode] : []

  // Build adjacency
  const childrenMap = new Map<string, string[]>()
  for (const edge of edges) {
    const children = childrenMap.get(edge.source) || []
    children.push(edge.target)
    childrenMap.set(edge.source, children)
  }

  // BFS
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set(ordered.map((n) => n.id))
  const queue = ordered.map((n) => n.id)

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

  // Add any orphan nodes not connected
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node)
    }
  }

  const NODE_WIDTH = 280
  const NODE_GAP = 80

  return ordered.map((node, index) => ({
    ...node,
    position: { x: 0, y: index * (60 + NODE_GAP) } as WorkflowNodePosition
  }))
}

/**
 * Insert a new node between source and target, splitting an edge.
 */
export function insertNodeBetween(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  edgeId: string,
  newNode: WorkflowNode
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const edge = edges.find((e) => e.id === edgeId)
  if (!edge) return { nodes, edges }

  const newEdges = edges.filter((e) => e.id !== edgeId)
  newEdges.push(
    { id: crypto.randomUUID(), source: edge.source, target: newNode.id },
    { id: crypto.randomUUID(), source: newNode.id, target: edge.target }
  )

  const newNodes = [...nodes, newNode]
  return { nodes: autoLayoutNodes(newNodes, newEdges), edges: newEdges }
}

/**
 * Append a new node at the end of the chain.
 */
export function appendNode(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  newNode: WorkflowNode
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  // Find the last node (no outgoing edges)
  const nodesWithOutgoing = new Set(edges.map((e) => e.source))
  const lastNode = [...nodes].reverse().find((n) => !nodesWithOutgoing.has(n.id))

  const newEdges = [...edges]
  if (lastNode) {
    newEdges.push({ id: crypto.randomUUID(), source: lastNode.id, target: newNode.id })
  }

  const newNodes = [...nodes, newNode]
  return { nodes: autoLayoutNodes(newNodes, newEdges), edges: newEdges }
}

/**
 * Remove a node and reconnect its parent to its child.
 */
export function removeNode(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const incomingEdges = edges.filter((e) => e.target === nodeId)
  const outgoingEdges = edges.filter((e) => e.source === nodeId)

  let newEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId)

  // Reconnect: each parent -> each child
  for (const incoming of incomingEdges) {
    for (const outgoing of outgoingEdges) {
      newEdges.push({ id: crypto.randomUUID(), source: incoming.source, target: outgoing.target })
    }
  }

  const newNodes = nodes.filter((n) => n.id !== nodeId)
  return { nodes: autoLayoutNodes(newNodes, newEdges), edges: newEdges }
}
