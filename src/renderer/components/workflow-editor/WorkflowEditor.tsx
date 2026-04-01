import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Play, Trash2, History, Zap } from 'lucide-react'
import { ICON_MAP } from '../project-sidebar/icon-map'
import { PROJECT_ICON_OPTIONS, ICON_COLOR_PALETTE } from '../../lib/project-icons'
import { ToggleSwitch } from '../settings/ToggleSwitch'
import { useAppStore } from '../../stores'
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  TriggerConfig,
  AgentType,
  supportsExactSessionResume,
  getProjectRemoteHostId
} from '../../../shared/types'
import { WorkflowCanvas } from './WorkflowCanvas'
import { NodePalette } from './panels/NodePalette'
import { NodeConfigPanel } from './panels/NodeConfigPanel'
import { RunHistoryPanel } from './panels/RunHistoryPanel'
import {
  createTriggerNode,
  createLaunchAgentNode,
  createScriptNode,
  createConditionNode,
  appendNode,
  appendNodeAfter,
  insertNodeBetween,
  insertBeforeFork,
  insertConditionBetween,
  addParallelBranch,
  removeNode
} from '../../lib/workflow-helpers'
import { executeWorkflow } from '../../lib/workflow-execution'
import {
  slugify,
  ensureUniqueSlug,
  getAncestorNodes,
  buildStepGroups
} from '../../lib/template-vars'

const EMPTY_TASKS: import('../../../shared/types').TaskConfig[] = []

export function WorkflowEditor() {
  const isOpen = useAppStore((s) => s.isWorkflowEditorOpen)
  const editingId = useAppStore((s) => s.editingWorkflowId)
  const setOpen = useAppStore((s) => s.setWorkflowEditorOpen)
  const setEditingId = useAppStore((s) => s.setEditingWorkflowId)
  const addWorkflow = useAppStore((s) => s.addWorkflow)
  const updateWorkflow = useAppStore((s) => s.updateWorkflow)
  const removeWorkflowFromStore = useAppStore((s) => s.removeWorkflow)
  const existingWorkflow = useAppStore((s) =>
    editingId ? (s.config?.workflows || []).find((w) => w.id === editingId) : null
  )
  const tasks = useAppStore((s) => s.config?.tasks ?? EMPTY_TASKS)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const setFocusedTerminal = useAppStore((s) => s.setFocusedTerminal)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)

  const [name, setName] = useState('New Workflow')
  const [icon, setIcon] = useState('Zap')
  const [iconColor, setIconColor] = useState('#3b82f6')
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [enabled, setEnabled] = useState(true)
  const [staggerDelayMs, setStaggerDelayMs] = useState<number | undefined>(undefined)
  const [autoCleanupWorktrees, setAutoCleanupWorktrees] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showRunHistory, setShowRunHistory] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const iconPickerRef = useRef<HTMLDivElement>(null)
  const [executionHistory, setExecutionHistory] = useState<
    import('../../../shared/types').WorkflowExecution[]
  >([])
  const loadedRunsForId = useRef<string | null>(null)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  )

  const hasTrigger = nodes.some((n) => n.type === 'trigger')

  // Compute the current trigger type from nodes
  const triggerType = useMemo(() => {
    const triggerNode = nodes.find((n) => n.type === 'trigger')
    if (!triggerNode) return undefined
    return (triggerNode.config as TriggerConfig).triggerType
  }, [nodes])

  const stepGroups = useMemo(() => {
    if (!selectedNodeId) return []
    const ancestors = getAncestorNodes(nodes, edges, selectedNodeId)
    return buildStepGroups(ancestors)
  }, [nodes, edges, selectedNodeId])

  // Load execution history from database
  useEffect(() => {
    if (editingId && isOpen && loadedRunsForId.current !== editingId) {
      loadedRunsForId.current = editingId
      window.api.listWorkflowRuns(editingId, 20).then(setExecutionHistory)
    }
    if (!isOpen) {
      loadedRunsForId.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExecutionHistory([])
    }
  }, [editingId, isOpen])

  // Load existing workflow when editing (with slug migration)
  useEffect(() => {
    if (existingWorkflow) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(existingWorkflow.name)
      setIcon(existingWorkflow.icon)
      setIconColor(existingWorkflow.iconColor)
      const usedSlugs = new Set<string>()
      const migratedNodes = existingWorkflow.nodes.map((n) => {
        if (n.slug) {
          if (usedSlugs.has(n.slug)) {
            const uniqueSlug = ensureUniqueSlug(n.slug, usedSlugs)
            usedSlugs.add(uniqueSlug)
            return { ...n, slug: uniqueSlug }
          }
          usedSlugs.add(n.slug)
          return n
        }
        if (n.type === 'trigger') return n
        const slug = ensureUniqueSlug(slugify(n.label), usedSlugs)
        usedSlugs.add(slug)
        return { ...n, slug }
      })
      setNodes(migratedNodes)
      setEdges(existingWorkflow.edges)
      setEnabled(existingWorkflow.enabled)
      setStaggerDelayMs(existingWorkflow.staggerDelayMs)
      setAutoCleanupWorktrees(existingWorkflow.autoCleanupWorktrees ?? false)
    } else if (!editingId) {
      // New workflow — start with a manual trigger
      const trigger = createTriggerNode({ triggerType: 'manual' })
      setName('New Workflow')
      setIcon('Zap')
      setIconColor('#3b82f6')
      setNodes([trigger])
      setEdges([])
      setEnabled(true)
      setStaggerDelayMs(undefined)
    }
    setSelectedNodeId(null)
    setShowRunHistory(false)
  }, [existingWorkflow, editingId, isOpen])

  useEffect(() => {
    if (!showIconPicker) return
    const handler = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showIconPicker])

  const handleClose = useCallback(() => {
    setOpen(false)
    setEditingId(null)
    setSelectedNodeId(null)
    setShowRunHistory(false)
  }, [setOpen, setEditingId])

  const activeWorkspace = useAppStore((s) => s.activeWorkspace)

  const handleSave = useCallback(() => {
    const workflow: WorkflowDefinition = {
      id: editingId || crypto.randomUUID(),
      name,
      icon,
      iconColor,
      nodes,
      edges,
      enabled,
      ...(staggerDelayMs && { staggerDelayMs }),
      ...(autoCleanupWorktrees && { autoCleanupWorktrees }),
      ...(existingWorkflow?.lastRunAt && { lastRunAt: existingWorkflow.lastRunAt }),
      ...(existingWorkflow?.lastRunStatus && { lastRunStatus: existingWorkflow.lastRunStatus }),
      workspaceId: existingWorkflow?.workspaceId ?? activeWorkspace
    }

    if (editingId) {
      updateWorkflow(editingId, workflow)
    } else {
      addWorkflow(workflow)
    }
    handleClose()
  }, [
    editingId,
    name,
    icon,
    iconColor,
    nodes,
    edges,
    enabled,
    staggerDelayMs,
    autoCleanupWorktrees,
    existingWorkflow,
    updateWorkflow,
    addWorkflow,
    handleClose,
    activeWorkspace
  ])

  const handleRun = useCallback(async () => {
    // Save first, then execute
    const workflow: WorkflowDefinition = {
      id: editingId || crypto.randomUUID(),
      name,
      icon,
      iconColor,
      nodes,
      edges,
      enabled,
      ...(staggerDelayMs && { staggerDelayMs }),
      ...(autoCleanupWorktrees && { autoCleanupWorktrees }),
      workspaceId: existingWorkflow?.workspaceId ?? activeWorkspace
    }
    if (editingId) {
      updateWorkflow(editingId, workflow)
    } else {
      addWorkflow(workflow)
    }
    handleClose()
    await executeWorkflow(workflow)
  }, [
    editingId,
    name,
    icon,
    iconColor,
    nodes,
    edges,
    enabled,
    staggerDelayMs,
    autoCleanupWorktrees,
    existingWorkflow,
    updateWorkflow,
    addWorkflow,
    handleClose,
    activeWorkspace
  ])

  const handleDelete = useCallback(() => {
    if (editingId) {
      removeWorkflowFromStore(editingId)
    }
    handleClose()
  }, [editingId, removeWorkflowFromStore, handleClose])

  // Node management
  const handleAddTrigger = useCallback(
    (type: TriggerConfig['triggerType']) => {
      const configMap: Record<TriggerConfig['triggerType'], TriggerConfig> = {
        manual: { triggerType: 'manual' },
        once: { triggerType: 'once', runAt: new Date().toISOString() },
        recurring: { triggerType: 'recurring', cron: '0 9 * * *' },
        taskCreated: { triggerType: 'taskCreated' },
        taskStatusChanged: { triggerType: 'taskStatusChanged' }
      }
      const trigger = createTriggerNode(configMap[type])

      if (nodes.length === 0) {
        setNodes([trigger])
      } else {
        const result = appendNode(nodes, edges, trigger)
        setNodes(result.nodes)
        setEdges(result.edges)
      }
      setSelectedNodeId(trigger.id)
    },
    [nodes, edges]
  )

  const handleAddLaunchAgent = useCallback(() => {
    const projects = useAppStore.getState().config?.projects || []
    const firstProject = projects[0]
    const agent = createLaunchAgentNode(
      firstProject ? { projectName: firstProject.name, projectPath: firstProject.path } : {}
    )

    const result = appendNode(nodes, edges, agent)
    setNodes(result.nodes)
    setEdges(result.edges)
    setSelectedNodeId(agent.id)
  }, [nodes, edges])

  const handleAddScript = useCallback(() => {
    const script = createScriptNode()
    const result = appendNode(nodes, edges, script)
    setNodes(result.nodes)
    setEdges(result.edges)
    setSelectedNodeId(script.id)
  }, [nodes, edges])

  // Helper: create a node with a unique slug
  const createNodeWithUniqueSlug = useCallback(
    (type: 'agent' | 'script' | 'condition') => {
      const projects = useAppStore.getState().config?.projects || []
      const firstProject = projects[0]
      const newNode =
        type === 'condition'
          ? createConditionNode()
          : type === 'script'
            ? createScriptNode()
            : createLaunchAgentNode(
                firstProject
                  ? { projectName: firstProject.name, projectPath: firstProject.path }
                  : {}
              )
      if (newNode.slug) {
        const existingSlugs = new Set(nodes.filter((n) => n.slug).map((n) => n.slug!))
        newNode.slug = ensureUniqueSlug(newNode.slug, existingSlugs)
      }
      return newNode
    },
    [nodes]
  )

  // Canvas "+" button handlers — insert between nodes or append at end
  const handleInsertNode = useCallback(
    (afterNodeId: string, beforeNodeId: string | null, type: 'agent' | 'script' | 'condition') => {
      // Condition nodes use a special insertion that creates true/false branches
      if (type === 'condition') {
        const result = insertConditionBetween(nodes, edges, afterNodeId, beforeNodeId)
        setNodes(result.nodes)
        setEdges(result.edges)
        // Select the condition node (last added)
        const condNode = result.nodes.find(
          (n) => n.type === 'condition' && !nodes.find((o) => o.id === n.id)
        )
        if (condNode) setSelectedNodeId(condNode.id)
        return
      }

      const newNode = createNodeWithUniqueSlug(type)

      let result: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }
      if (beforeNodeId === '__FORK__') {
        result = insertBeforeFork(nodes, edges, afterNodeId, newNode)
      } else if (beforeNodeId) {
        const edge = edges.find((e) => e.source === afterNodeId && e.target === beforeNodeId)
        if (edge) {
          result = insertNodeBetween(nodes, edges, edge.id, newNode)
        } else {
          result = appendNodeAfter(nodes, edges, afterNodeId, newNode)
        }
      } else {
        result = appendNodeAfter(nodes, edges, afterNodeId, newNode)
      }

      setNodes(result.nodes)
      setEdges(result.edges)
      setSelectedNodeId(newNode.id)
    },
    [nodes, edges, createNodeWithUniqueSlug]
  )

  // Canvas "+" button handler — add a parallel branch
  const handleAddParallelBranch = useCallback(
    (forkFromId: string, type: 'agent' | 'script') => {
      const newNode = createNodeWithUniqueSlug(type)
      const result = addParallelBranch(nodes, edges, forkFromId, newNode)
      setNodes(result.nodes)
      setEdges(result.edges)
      setSelectedNodeId(newNode.id)
    },
    [nodes, edges, createNodeWithUniqueSlug]
  )

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId || null)
    setShowRunHistory(false)
  }, [])

  const handleNodeConfigChange = useCallback((nodeId: string, config: WorkflowNode['config']) => {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, config } : n)))
  }, [])

  const handleNodeLabelChange = useCallback((nodeId: string, label: string) => {
    setNodes((nds) => {
      const node = nds.find((n) => n.id === nodeId)
      const oldSlug = node?.slug
      const existingSlugs = new Set(
        nds.filter((n) => n.id !== nodeId && n.slug).map((n) => n.slug!)
      )
      const newSlug = ensureUniqueSlug(slugify(label), existingSlugs)

      return nds.map((n) => {
        if (n.id === nodeId) return { ...n, label, slug: newSlug }
        // Update template references in other nodes when slug changes
        if (oldSlug && oldSlug !== newSlug && n.config) {
          const configStr = JSON.stringify(n.config)
          if (configStr.includes(`steps.${oldSlug}.`)) {
            return {
              ...n,
              config: JSON.parse(configStr.split(`steps.${oldSlug}.`).join(`steps.${newSlug}.`))
            }
          }
        }
        return n
      })
    })
  }, [])

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const result = removeNode(nodes, edges, nodeId)
      setNodes(result.nodes)
      setEdges(result.edges)
      setSelectedNodeId(null)
    },
    [nodes, edges]
  )

  const handleResumeSession = useCallback(
    async (
      agentSessionId: string,
      agentType: AgentType,
      projectName: string,
      projectPath: string,
      branch?: string,
      useWorktree?: boolean
    ) => {
      if (!supportsExactSessionResume(agentType)) return

      const cfg = useAppStore.getState().config
      const proj = cfg?.projects.find((p) => p.name === projectName)
      const remoteHostId = proj ? getProjectRemoteHostId(proj) : undefined
      const session = await window.api.createTerminal({
        agentType,
        projectName,
        projectPath,
        branch,
        useWorktree,
        resumeSessionId: agentSessionId,
        remoteHostId
      })
      addTerminal(session)
      setFocusedTerminal(session.id)
      handleClose()
    },
    [addTerminal, setFocusedTerminal, handleClose]
  )

  const handleClickTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId)
      handleClose()
    },
    [setSelectedTaskId, handleClose]
  )

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col titlebar-no-drag"
      style={{
        background: '#1a1a1e',
        paddingTop: 'var(--safe-top, 0px)',
        paddingRight: 'var(--safe-right, 0px)',
        paddingBottom: 'var(--safe-bottom, 0px)',
        paddingLeft: 'var(--safe-left, 0px)'
      }}
    >
      {/* Top bar */}
      <div className="shrink-0 h-[52px] flex items-center justify-between px-4 border-b border-white/[0.08] titlebar-drag">
        <div className="flex items-center gap-3 titlebar-no-drag" style={{ paddingLeft: '70px' }}>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-md transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="p-1.5 rounded-md hover:bg-white/[0.08] transition-colors"
              title="Change icon"
            >
              {(() => {
                const WfIcon = ICON_MAP[icon] || Zap
                return <WfIcon size={16} color={iconColor} strokeWidth={1.5} />
              })()}
            </button>
            {showIconPicker && (
              <div
                ref={iconPickerRef}
                className="absolute top-full left-0 mt-1 p-2 rounded-lg border border-white/[0.08] shadow-xl z-50 w-[220px] space-y-2"
                style={{ background: '#1e1e22' }}
              >
                <div className="grid grid-cols-8 gap-1">
                  {PROJECT_ICON_OPTIONS.map((opt) => {
                    const IconComp = ICON_MAP[opt.name] || Zap
                    return (
                      <button
                        key={opt.name}
                        onClick={() => setIcon(opt.name)}
                        className={`p-1.5 rounded ${
                          icon === opt.name
                            ? 'bg-white/[0.1] ring-1 ring-white/[0.2]'
                            : 'hover:bg-white/[0.06]'
                        }`}
                        title={opt.label}
                      >
                        <IconComp
                          size={12}
                          color={icon === opt.name ? iconColor : '#9ca3af'}
                          strokeWidth={1.5}
                        />
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-1.5">
                  {ICON_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setIconColor(color)}
                      className={`w-5 h-5 rounded-full border ${
                        iconColor === color
                          ? 'border-white scale-110'
                          : 'border-transparent hover:border-white/30'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-[15px] font-medium text-white bg-transparent border-none outline-none
                       hover:bg-white/[0.04] focus:bg-white/[0.06] px-2 py-1 rounded-md transition-colors
                       w-[240px]"
            placeholder="Workflow name"
          />
        </div>

        <div className="flex items-center gap-2 titlebar-no-drag">
          {/* Stagger delay */}
          <div className="flex items-center gap-1.5 mr-2">
            <label className="text-[11px] text-gray-500">Stagger</label>
            <input
              type="number"
              value={staggerDelayMs || ''}
              onChange={(e) =>
                setStaggerDelayMs(e.target.value ? parseInt(e.target.value) : undefined)
              }
              placeholder="0ms"
              className="w-[70px] px-2 py-1 text-[12px] bg-white/[0.06] border border-white/[0.08] rounded-md
                         text-gray-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 mr-2">
            <span
              className="text-[11px] text-gray-500"
              title="Auto-remove worktrees created during this run (skips dirty)"
            >
              Cleanup worktrees
            </span>
            <ToggleSwitch checked={autoCleanupWorktrees} onChange={setAutoCleanupWorktrees} />
          </div>

          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[12px] text-gray-400">Enabled</span>
            <ToggleSwitch checked={enabled} onChange={setEnabled} />
          </div>

          {editingId && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-[12px] text-red-400 hover:text-red-300
                         bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors
                         flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}

          {/* Run History toggle */}
          {editingId && executionHistory.length > 0 && (
            <button
              onClick={() => {
                setShowRunHistory(!showRunHistory)
                if (!showRunHistory) setSelectedNodeId(null)
              }}
              className={`px-3 py-1.5 text-[12px] rounded-md transition-colors flex items-center gap-1.5
                         ${
                           showRunHistory
                             ? 'text-purple-400 bg-purple-500/20 hover:bg-purple-500/30'
                             : 'text-gray-400 hover:text-gray-300 bg-white/[0.06] hover:bg-white/[0.1]'
                         }`}
            >
              <History size={13} />
              Runs ({executionHistory.length})
            </button>
          )}

          <button
            onClick={handleRun}
            className="px-3 py-1.5 text-[12px] text-green-400 hover:text-green-300
                       bg-green-500/10 hover:bg-green-500/20 rounded-md transition-colors
                       flex items-center gap-1.5"
          >
            <Play size={13} />
            Run
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-[12px] font-medium text-white
                       bg-blue-600 hover:bg-blue-500 rounded-md transition-colors
                       flex items-center gap-1.5"
          >
            <Save size={13} />
            Save
          </button>
        </div>
      </div>

      {/* Main content: palette + canvas + config/history panel */}
      <div className="flex-1 flex overflow-hidden titlebar-no-drag">
        <NodePalette
          onAddTrigger={handleAddTrigger}
          onAddLaunchAgent={handleAddLaunchAgent}
          onAddScript={handleAddScript}
          hasTrigger={hasTrigger}
        />

        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onInsertNode={handleInsertNode}
          onAddParallelBranch={handleAddParallelBranch}
          selectedNodeId={selectedNodeId}
        />

        {showRunHistory && (
          <RunHistoryPanel
            executions={executionHistory}
            nodes={nodes}
            tasks={tasks}
            onClose={() => setShowRunHistory(false)}
            onClickTask={handleClickTask}
            onResumeSession={handleResumeSession}
          />
        )}

        {selectedNode && !showRunHistory && (
          <NodeConfigPanel
            node={selectedNode}
            allNodes={nodes}
            onChange={handleNodeConfigChange}
            onLabelChange={handleNodeLabelChange}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
            triggerType={triggerType}
            stepGroups={stepGroups}
          />
        )}
      </div>
    </motion.div>
  )
}
