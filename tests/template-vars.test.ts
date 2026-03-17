import { describe, it, expect } from 'vitest'
import {
  slugify,
  ensureUniqueSlug,
  getAncestorNodes,
  buildStepGroups,
  resolveTemplateVars
} from '../src/renderer/lib/template-vars'
import type { WorkflowNode, WorkflowEdge, WorkflowExecutionContext } from '../src/shared/types'
import type { StepOutputs } from '../src/renderer/lib/template-vars'

function makeNode(id: string, type: string, slug?: string): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    label: id,
    slug,
    config: { triggerType: 'manual' },
    position: { x: 0, y: 0 }
  }
}

function makeEdge(source: string, target: string): WorkflowEdge {
  return { id: `${source}->${target}`, source, target }
}

describe('slugify', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slugify('Launch Agent')).toBe('launch_agent')
  })

  it('strips special characters', () => {
    expect(slugify('Hello World!')).toBe('hello_world')
  })

  it('removes leading and trailing underscores', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })

  it('collapses consecutive underscores', () => {
    expect(slugify('a---b___c')).toBe('a_b_c')
  })

  it('returns "step" for empty string', () => {
    expect(slugify('')).toBe('step')
  })

  it('returns "step" for string with only special chars', () => {
    expect(slugify('!!!')).toBe('step')
  })
})

describe('ensureUniqueSlug', () => {
  it('returns slug if not in set', () => {
    expect(ensureUniqueSlug('foo', new Set(['bar']))).toBe('foo')
  })

  it('appends _2 on first collision', () => {
    expect(ensureUniqueSlug('foo', new Set(['foo']))).toBe('foo_2')
  })

  it('appends _3 when _2 also exists', () => {
    expect(ensureUniqueSlug('foo', new Set(['foo', 'foo_2']))).toBe('foo_3')
  })
})

describe('getAncestorNodes', () => {
  it('returns empty for node with no predecessors', () => {
    const nodes = [makeNode('a', 'launchAgent')]
    expect(getAncestorNodes(nodes, [], 'a')).toEqual([])
  })

  it('returns predecessors in BFS order (excluding triggers)', () => {
    const nodes = [
      makeNode('t', 'trigger'),
      makeNode('a', 'launchAgent'),
      makeNode('b', 'launchAgent')
    ]
    const edges = [makeEdge('t', 'a'), makeEdge('a', 'b')]
    const result = getAncestorNodes(nodes, edges, 'b')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('excludes trigger nodes from results', () => {
    const nodes = [makeNode('t', 'trigger'), makeNode('a', 'launchAgent')]
    const edges = [makeEdge('t', 'a')]
    const result = getAncestorNodes(nodes, edges, 'a')
    expect(result).toEqual([])
  })

  it('handles diamond DAG without duplicates', () => {
    const nodes = [
      makeNode('t', 'trigger'),
      makeNode('a', 'launchAgent'),
      makeNode('b', 'launchAgent'),
      makeNode('c', 'launchAgent')
    ]
    const edges = [makeEdge('t', 'a'), makeEdge('t', 'b'), makeEdge('a', 'c'), makeEdge('b', 'c')]
    const result = getAncestorNodes(nodes, edges, 'c')
    expect(result).toHaveLength(2)
    const ids = result.map((n) => n.id).sort()
    expect(ids).toEqual(['a', 'b'])
  })
})

describe('buildStepGroups', () => {
  it('filters nodes without slug', () => {
    const nodes = [makeNode('a', 'launchAgent', 'step_a'), makeNode('b', 'launchAgent')]
    const groups = buildStepGroups(nodes)
    expect(groups).toHaveLength(1)
    expect(groups[0].slug).toBe('step_a')
  })

  it('maps to StepVariableGroup with default output keys', () => {
    const nodes = [makeNode('a', 'script', 'my_script')]
    const groups = buildStepGroups(nodes)
    expect(groups[0].keys).toHaveLength(3)
    expect(groups[0].keys.map((k) => k.key)).toEqual(['output', 'status', 'error'])
  })
})

describe('resolveTemplateVars', () => {
  const context: WorkflowExecutionContext = {
    task: {
      id: 'abc123',
      projectName: 'MyProject',
      title: 'Fix bug',
      description: 'Fix the login bug',
      status: 'in_progress',
      order: 0,
      createdAt: '',
      updatedAt: ''
    },
    trigger: { type: 'taskStatusChanged', fromStatus: 'todo', toStatus: 'in_progress' }
  }

  it('resolves task variables', () => {
    expect(resolveTemplateVars('Title: {{task.title}}', context)).toBe('Title: Fix bug')
  })

  it('resolves trigger variables', () => {
    expect(resolveTemplateVars('From: {{trigger.fromStatus}}', context)).toBe('From: todo')
  })

  it('resolves step outputs', () => {
    const outputs: StepOutputs = { build: { output: 'success', status: 'ok' } }
    expect(resolveTemplateVars('Result: {{steps.build.output}}', context, outputs)).toBe(
      'Result: success'
    )
  })

  it('returns empty for missing step output', () => {
    const outputs: StepOutputs = {}
    expect(resolveTemplateVars('{{steps.unknown.output}}', context, outputs)).toBe('')
  })

  it('returns match verbatim for unknown namespace', () => {
    expect(resolveTemplateVars('{{unknown.key}}', context)).toBe('{{unknown.key}}')
  })

  it('returns empty string for empty template', () => {
    expect(resolveTemplateVars('', context)).toBe('')
  })

  it('returns template unchanged when no context provided', () => {
    expect(resolveTemplateVars('{{task.title}}')).toBe('{{task.title}}')
  })

  it('truncates step output longer than 50k chars', () => {
    const longOutput = 'x'.repeat(60_000)
    const outputs: StepOutputs = { build: { output: longOutput } }
    const result = resolveTemplateVars('{{steps.build.output}}', context, outputs)
    expect(result.length).toBe(50_000)
  })
})
