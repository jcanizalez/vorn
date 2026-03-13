import {
  TaskConfig,
  WorkflowExecutionContext,
  WorkflowNode,
  WorkflowEdge
} from '../../shared/types'

// --- Slug Utilities ---

export function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .replace(/_+/g, '_') || 'step'
  )
}

export function ensureUniqueSlug(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) return slug
  let i = 2
  while (existing.has(`${slug}_${i}`)) i++
  return `${slug}_${i}`
}

// --- Step Output Types ---

export type StepOutputs = Record<string, Record<string, string>>

export const DEFAULT_OUTPUT_KEYS = [
  { key: 'output', label: 'Output', description: 'Primary output (stdout / agent logs)' },
  { key: 'status', label: 'Status', description: 'success or error' },
  { key: 'error', label: 'Error', description: 'Error message if failed' }
] as const

// --- Variable Group for Autocomplete UI ---

export interface StepVariableGroup {
  nodeId: string
  label: string
  slug: string
  nodeType: string
  disabled?: boolean
  keys: { key: string; label: string; description: string }[]
}

// --- Template Variable Types ---

export interface TemplateVariable {
  key: string
  label: string
  category: 'task' | 'trigger'
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: '{{task.title}}', label: 'Title', category: 'task' },
  { key: '{{task.description}}', label: 'Description', category: 'task' },
  { key: '{{task.id}}', label: 'ID', category: 'task' },
  { key: '{{task.status}}', label: 'Status', category: 'task' },
  { key: '{{task.branch}}', label: 'Branch', category: 'task' },
  { key: '{{task.projectName}}', label: 'Project', category: 'task' },
  { key: '{{trigger.fromStatus}}', label: 'Previous Status', category: 'trigger' },
  { key: '{{trigger.toStatus}}', label: 'New Status', category: 'trigger' }
]

// --- DAG Ancestor Computation ---

export function getAncestorNodes(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  currentNodeId: string
): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const predecessorsMap = new Map<string, string[]>()
  for (const edge of edges) {
    const preds = predecessorsMap.get(edge.target) || []
    preds.push(edge.source)
    predecessorsMap.set(edge.target, preds)
  }

  const ancestors: WorkflowNode[] = []
  const visited = new Set<string>()
  const queue = [currentNodeId]
  visited.add(currentNodeId)

  while (queue.length > 0) {
    const id = queue.shift()!
    const preds = predecessorsMap.get(id) || []
    for (const predId of preds) {
      if (visited.has(predId)) continue
      visited.add(predId)
      queue.push(predId)
      const node = nodeMap.get(predId)
      if (node && node.type !== 'trigger') {
        ancestors.push(node)
      }
    }
  }

  return ancestors
}

export function buildStepGroups(ancestorNodes: WorkflowNode[]): StepVariableGroup[] {
  return ancestorNodes
    .filter((n) => n.slug)
    .map((n) => {
      return {
        nodeId: n.id,
        label: n.label,
        slug: n.slug!,
        nodeType: n.type,
        keys: DEFAULT_OUTPUT_KEYS.map((k) => ({ ...k }))
      }
    })
}

// --- Template Variable Resolution ---

const MAX_OUTPUT_LENGTH = 50_000

export function resolveTemplateVars(
  template: string,
  context?: WorkflowExecutionContext,
  stepOutputs?: StepOutputs
): string {
  if (!template) return template
  if (!context && !stepOutputs) return template

  return template.replace(
    /\{\{(\w+)\.([\w]+)(?:\.([\w]+))?\}\}/g,
    (match, ns: string, key: string, subkey?: string) => {
      if (ns === 'steps' && subkey && stepOutputs) {
        const stepData = stepOutputs[key]
        if (!stepData) return ''
        const val = stepData[subkey]
        if (val == null) return ''
        if (val.length > MAX_OUTPUT_LENGTH) {
          return val.slice(-MAX_OUTPUT_LENGTH)
        }
        return val
      }

      if (ns === 'task' && context?.task) {
        const val = context.task[key as keyof TaskConfig]
        return val != null ? String(val) : ''
      }
      if (ns === 'trigger' && context?.trigger) {
        const triggerObj = context.trigger as Record<string, unknown>
        const val = triggerObj[key]
        return val != null ? String(val) : ''
      }

      return match
    }
  )
}
