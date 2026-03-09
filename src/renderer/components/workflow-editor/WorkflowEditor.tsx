import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Play, Trash2 } from 'lucide-react'
import { useAppStore } from '../../stores'
import {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  TriggerConfig,
  LaunchAgentConfig
} from '../../../shared/types'
import { WorkflowCanvas } from './WorkflowCanvas'
import { NodePalette } from './panels/NodePalette'
import { NodeConfigPanel } from './panels/NodeConfigPanel'
import {
  createTriggerNode,
  createLaunchAgentNode,
  appendNode,
  removeNode,
  autoLayoutNodes
} from '../../lib/workflow-helpers'
import { executeWorkflow } from '../../lib/workflow-execution'

const ICON_MAP: Record<string, any> = {}
// We reuse the same icon approach as sidebar — icon name stored as string

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

  const [name, setName] = useState('New Workflow')
  const [icon, setIcon] = useState('Zap')
  const [iconColor, setIconColor] = useState('#3b82f6')
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [enabled, setEnabled] = useState(true)
  const [staggerDelayMs, setStaggerDelayMs] = useState<number | undefined>(undefined)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  )

  const hasTrigger = nodes.some((n) => n.type === 'trigger')

  // Load existing workflow when editing
  useEffect(() => {
    if (existingWorkflow) {
      setName(existingWorkflow.name)
      setIcon(existingWorkflow.icon)
      setIconColor(existingWorkflow.iconColor)
      setNodes(existingWorkflow.nodes)
      setEdges(existingWorkflow.edges)
      setEnabled(existingWorkflow.enabled)
      setStaggerDelayMs(existingWorkflow.staggerDelayMs)
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
  }, [existingWorkflow, editingId, isOpen])

  const handleClose = useCallback(() => {
    setOpen(false)
    setEditingId(null)
    setSelectedNodeId(null)
  }, [setOpen, setEditingId])

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
      ...(existingWorkflow?.lastRunAt && { lastRunAt: existingWorkflow.lastRunAt }),
      ...(existingWorkflow?.lastRunStatus && { lastRunStatus: existingWorkflow.lastRunStatus })
    }

    if (editingId) {
      updateWorkflow(editingId, workflow)
    } else {
      addWorkflow(workflow)
    }
    handleClose()
  }, [editingId, name, icon, iconColor, nodes, edges, enabled, staggerDelayMs, existingWorkflow, updateWorkflow, addWorkflow, handleClose])

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
      ...(staggerDelayMs && { staggerDelayMs })
    }
    if (editingId) {
      updateWorkflow(editingId, workflow)
    } else {
      addWorkflow(workflow)
    }
    handleClose()
    await executeWorkflow(workflow)
  }, [editingId, name, icon, iconColor, nodes, edges, enabled, staggerDelayMs, updateWorkflow, addWorkflow, handleClose])

  const handleDelete = useCallback(() => {
    if (editingId) {
      removeWorkflowFromStore(editingId)
    }
    handleClose()
  }, [editingId, removeWorkflowFromStore, handleClose])

  // Node management
  const handleAddTrigger = useCallback((type: TriggerConfig['triggerType']) => {
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
  }, [nodes, edges])

  const handleAddLaunchAgent = useCallback(() => {
    const projects = useAppStore.getState().config?.projects || []
    const firstProject = projects[0]
    const agent = createLaunchAgentNode(
      firstProject
        ? { projectName: firstProject.name, projectPath: firstProject.path }
        : {}
    )

    const result = appendNode(nodes, edges, agent)
    setNodes(result.nodes)
    setEdges(result.edges)
    setSelectedNodeId(agent.id)
  }, [nodes, edges])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId || null)
  }, [])

  const handleNodeConfigChange = useCallback((nodeId: string, config: WorkflowNode['config']) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, config } : n
    ))
  }, [])

  const handleNodeLabelChange = useCallback((nodeId: string, label: string) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, label } : n
    ))
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    const result = removeNode(nodes, edges, nodeId)
    setNodes(result.nodes)
    setEdges(result.edges)
    setSelectedNodeId(null)
  }, [nodes, edges])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col titlebar-no-drag"
      style={{ background: '#1a1a1e' }}
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
              onChange={(e) => setStaggerDelayMs(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="0ms"
              className="w-[70px] px-2 py-1 text-[12px] bg-white/[0.06] border border-white/[0.08] rounded-md
                         text-gray-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <label className="flex items-center gap-1.5 text-[12px] text-gray-400 mr-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            Enabled
          </label>

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

      {/* Main content: palette + canvas + config panel */}
      <div className="flex-1 flex overflow-hidden titlebar-no-drag">
        <NodePalette
          onAddTrigger={handleAddTrigger}
          onAddLaunchAgent={handleAddLaunchAgent}
          hasTrigger={hasTrigger}
        />

        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onAddNodeAtEnd={handleAddLaunchAgent}
          selectedNodeId={selectedNodeId}
        />

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onChange={handleNodeConfigChange}
            onLabelChange={handleNodeLabelChange}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </motion.div>
  )
}
