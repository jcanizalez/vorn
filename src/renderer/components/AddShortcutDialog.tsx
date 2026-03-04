import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentType, ShortcutAction, getProjectHostIds } from '../../shared/types'
import { PROJECT_ICON_OPTIONS, ICON_COLOR_PALETTE } from '../lib/project-icons'
import { AGENT_LIST } from '../lib/agent-definitions'
import {
  Folder, FolderGit2, Code, Globe, Database, Server, Smartphone, Package,
  FileCode, Terminal, Cpu, Cloud, Shield, Zap, Gamepad2, Music, Image,
  BookOpen, FlaskConical, Rocket, GitBranch
} from 'lucide-react'

const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string; strokeWidth?: number }>> = {
  Folder, FolderGit2, Code, Globe, Database, Server, Smartphone, Package,
  FileCode, Terminal, Cpu, Cloud, Shield, Zap, Gamepad2, Music, Image,
  BookOpen, FlaskConical, Rocket
}

interface ActionRow {
  agentType: AgentType
  projectName: string
  projectPath: string
  args: string
  tabName: string
  branch: string
  useWorktree: boolean
  remoteHostId: string
}

function emptyAction(config: ReturnType<typeof useAppStore.getState>['config']): ActionRow {
  const firstProject = config?.projects[0]
  return {
    agentType: config?.defaults.defaultAgent || 'claude',
    projectName: firstProject?.name || '',
    projectPath: firstProject?.path || '',
    args: '',
    tabName: '',
    branch: '',
    useWorktree: false,
    remoteHostId: ''
  }
}

function shortcutActionToRow(action: ShortcutAction): ActionRow {
  return {
    agentType: action.agentType,
    projectName: action.projectName,
    projectPath: action.projectPath,
    args: action.args?.join(' ') || '',
    tabName: action.displayName || '',
    branch: action.branch || '',
    useWorktree: action.useWorktree || false,
    remoteHostId: action.remoteHostId || ''
  }
}

export function AddShortcutDialog() {
  const isOpen = useAppStore((s) => s.isShortcutDialogOpen)
  const setOpen = useAppStore((s) => s.setShortcutDialogOpen)
  const addShortcut = useAppStore((s) => s.addShortcut)
  const updateShortcut = useAppStore((s) => s.updateShortcut)
  const editingShortcut = useAppStore((s) => s.editingShortcut)
  const setEditingShortcut = useAppStore((s) => s.setEditingShortcut)
  const config = useAppStore((s) => s.config)

  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('Zap')
  const [selectedColor, setSelectedColor] = useState('#3b82f6')
  const [actions, setActions] = useState<ActionRow[]>([])

  const isEditMode = !!editingShortcut

  // Pre-fill fields when editing
  useEffect(() => {
    if (editingShortcut && isOpen) {
      setName(editingShortcut.name)
      setSelectedIcon(editingShortcut.icon || 'Zap')
      setSelectedColor(editingShortcut.iconColor || '#3b82f6')
      setActions(editingShortcut.actions.map(shortcutActionToRow))
    }
  }, [editingShortcut, isOpen])

  const handleClose = (): void => {
    setOpen(false)
    setEditingShortcut(null)
    setName('')
    setSelectedIcon('Zap')
    setSelectedColor('#3b82f6')
    setActions([])
  }

  const handleAddAction = (): void => {
    setActions([...actions, emptyAction(config)])
  }

  const handleRemoveAction = (index: number): void => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, updates: Partial<ActionRow>): void => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)))
  }

  const handleProjectChange = (index: number, projectName: string): void => {
    const project = config?.projects.find((p) => p.name === projectName)
    if (project) {
      updateAction(index, { projectName: project.name, projectPath: project.path })
    }
  }

  const handleSubmit = (): void => {
    if (!name.trim() || actions.length === 0) return
    const shortcutActions: ShortcutAction[] = actions.map((a) => ({
      agentType: a.agentType,
      projectName: a.projectName,
      projectPath: a.projectPath,
      ...(a.args.trim() ? { args: a.args.trim().split(/\s+/) } : {}),
      ...(a.tabName.trim() ? { displayName: a.tabName.trim() } : {}),
      ...(a.branch.trim() ? { branch: a.branch.trim() } : {}),
      ...(a.useWorktree ? { useWorktree: true } : {}),
      ...(a.remoteHostId ? { remoteHostId: a.remoteHostId } : {})
    }))

    if (isEditMode) {
      updateShortcut(editingShortcut.id, {
        id: editingShortcut.id,
        name: name.trim(),
        icon: selectedIcon,
        iconColor: selectedColor,
        actions: shortcutActions
      })
    } else {
      addShortcut({
        id: crypto.randomUUID(),
        name: name.trim(),
        icon: selectedIcon,
        iconColor: selectedColor,
        actions: shortcutActions
      })
    }
    handleClose()
  }

  const SelectedIconComponent = ICON_MAP[selectedIcon] || Zap
  const canSubmit = name.trim() && actions.length > 0 && actions.every((a) => a.projectName)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.div
            className="fixed top-1/2 left-1/2 z-50 w-[560px] max-h-[80vh] border border-white/[0.08]
                       rounded-xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: 'rgba(12, 16, 28, 0.95)' }}
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
              <h2 className="text-lg font-medium text-white">
                {isEditMode ? 'Edit Shortcut' : 'Add Shortcut'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isEditMode ? 'Update your shortcut settings' : 'Launch multiple sessions with one click'}
              </p>
            </div>

            <div className="p-6 space-y-5 overflow-auto">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Start Daily Work"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                             text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none"
                />
              </div>

              {/* Icon selector */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                  Icon
                </label>
                <div className="grid grid-cols-10 gap-1.5">
                  {PROJECT_ICON_OPTIONS.map((opt) => {
                    const IconComp = ICON_MAP[opt.name] || Folder
                    return (
                      <button
                        key={opt.name}
                        onClick={() => setSelectedIcon(opt.name)}
                        className={`flex items-center justify-center p-2 rounded-lg border transition-all ${
                          selectedIcon === opt.name
                            ? 'border-white/[0.2] bg-white/[0.08]'
                            : 'border-transparent hover:bg-white/[0.04]'
                        }`}
                        title={opt.label}
                      >
                        <IconComp size={16} color={selectedIcon === opt.name ? selectedColor : '#9ca3af'} strokeWidth={1.5} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                  Color
                </label>
                <div className="flex gap-2 items-center">
                  {ICON_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        selectedColor === color
                          ? 'border-white scale-110'
                          : 'border-transparent hover:border-white/30'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="ml-3 flex items-center gap-2">
                    <SelectedIconComponent size={20} color={selectedColor} strokeWidth={1.5} />
                    <span className="text-xs text-gray-500">Preview</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                  Actions
                </label>
                <div className="space-y-2">
                  {actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                      {/* Agent selector */}
                      <select
                        value={action.agentType}
                        onChange={(e) => updateAction(index, { agentType: e.target.value as AgentType })}
                        className="px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-md text-xs
                                   text-gray-200 focus:outline-none focus:border-white/[0.15]"
                      >
                        {AGENT_LIST.map((agent) => (
                          <option key={agent.type} value={agent.type}>
                            {agent.displayName}
                          </option>
                        ))}
                      </select>

                      {/* Project selector — filtered by host */}
                      <select
                        value={action.projectName}
                        onChange={(e) => handleProjectChange(index, e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-md text-xs
                                   text-gray-200 focus:outline-none focus:border-white/[0.15] min-w-0"
                      >
                        <option value="">Select project</option>
                        {config?.projects
                          .filter((p) => getProjectHostIds(p).includes(action.remoteHostId || 'local'))
                          .map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                      </select>

                      {/* Tab name input */}
                      <input
                        type="text"
                        placeholder="tab name"
                        value={action.tabName}
                        onChange={(e) => updateAction(index, { tabName: e.target.value })}
                        className="w-24 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs
                                   text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/[0.15]"
                      />

                      {/* Args input */}
                      <input
                        type="text"
                        placeholder="args"
                        value={action.args}
                        onChange={(e) => updateAction(index, { args: e.target.value })}
                        className="w-24 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs
                                   text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/[0.15]"
                      />

                      {/* Branch input */}
                      <div className="flex items-center gap-1">
                        <GitBranch size={11} className="text-gray-600 shrink-0" />
                        <input
                          type="text"
                          placeholder="branch"
                          value={action.branch}
                          onChange={(e) => updateAction(index, { branch: e.target.value })}
                          className="w-20 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-md text-xs
                                     text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/[0.15]"
                        />
                      </div>

                      {/* Worktree toggle */}
                      <button
                        onClick={() => updateAction(index, { useWorktree: !action.useWorktree })}
                        className={`p-1.5 rounded-md border transition-all shrink-0 ${
                          action.useWorktree
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                            : 'border-white/[0.06] text-gray-600 hover:text-gray-400'
                        }`}
                        title={action.useWorktree ? 'Worktree enabled' : 'Enable worktree'}
                      >
                        <FolderGit2 size={12} strokeWidth={1.5} />
                      </button>

                      {/* Remote host selector */}
                      {(config?.remoteHosts ?? []).length > 0 && (
                        <select
                          value={action.remoteHostId}
                          onChange={(e) => {
                            const newHostId = e.target.value
                            const effectiveHost = newHostId || 'local'
                            const currentProject = config?.projects.find((p) => p.name === action.projectName)
                            const projectAvailable = currentProject && getProjectHostIds(currentProject).includes(effectiveHost)
                            updateAction(index, {
                              remoteHostId: newHostId,
                              ...(projectAvailable ? {} : { projectName: '', projectPath: '' })
                            })
                          }}
                          className="px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded-md text-[11px]
                                     text-gray-300 focus:outline-none focus:border-white/[0.15] shrink-0"
                        >
                          <option value="">Local</option>
                          {config?.remoteHosts?.map((host) => (
                            <option key={host.id} value={host.id}>{host.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveAction(index)}
                        className="text-gray-600 hover:text-red-400 p-1 transition-colors shrink-0"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={handleAddAction}
                    className="w-full px-3 py-2 text-xs text-gray-500 hover:text-white
                               hover:bg-white/[0.04] border border-dashed border-white/[0.08]
                               rounded-lg transition-colors text-center"
                  >
                    + Add Action
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3 shrink-0">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200
                           bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-medium text-white
                           bg-white/[0.1] hover:bg-white/[0.15]
                           disabled:opacity-30 disabled:cursor-not-allowed
                           rounded-lg transition-colors"
              >
                {isEditMode ? 'Save' : 'Create Shortcut'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
