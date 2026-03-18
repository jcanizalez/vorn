import { useState, useRef, useEffect, useMemo, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentType, ProjectConfig } from '../../shared/types'
import { AGENT_LIST } from '../lib/agent-definitions'
import { AgentIcon } from './AgentIcon'
import { useLaunchSettings } from '../hooks/useLaunchSettings'
import { useAgentInstallStatus } from '../hooks/useAgentInstallStatus'
import { getRandomTips } from '../lib/tips-data'
import {
  Folder,
  FolderGit2,
  Code,
  Globe,
  Database,
  Server,
  Smartphone,
  Package,
  FileCode,
  Terminal,
  Cpu,
  Cloud,
  Shield,
  Zap,
  Gamepad2,
  Music,
  Image,
  BookOpen,
  FlaskConical,
  Rocket,
  GitBranch,
  ChevronDown,
  Loader2,
  ArrowUp,
  RefreshCw,
  Lightbulb
} from 'lucide-react'
import vibegridLogo from '../assets/vibegrid-logo.png'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, any> = {
  Folder,
  FolderGit2,
  Code,
  Globe,
  Database,
  Server,
  Smartphone,
  Package,
  FileCode,
  Terminal,
  Cpu,
  Cloud,
  Shield,
  Zap,
  Gamepad2,
  Music,
  Image,
  BookOpen,
  FlaskConical,
  Rocket
}

function ProjectIcon({ project, size = 14 }: { project?: ProjectConfig; size?: number }) {
  const IconComp = project?.icon ? ICON_MAP[project.icon] || Folder : Folder
  return (
    <IconComp size={size} style={project?.iconColor ? { color: project.iconColor } : undefined} />
  )
}

interface PromptLauncherProps {
  mode: 'inline' | 'overlay'
  onClose?: () => void
}

export function PromptLauncher({ mode, onClose }: PromptLauncherProps) {
  const config = useAppStore((s) => s.config)
  const addTerminal = useAppStore((s) => s.addTerminal)
  const isOpen = useAppStore((s) => s.isNewAgentDialogOpen)

  const [prompt, setPrompt] = useState('')
  const [launching, setLaunching] = useState(false)
  const [showAgentPicker, setShowAgentPicker] = useState(false)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const agentPickerRef = useRef<HTMLDivElement>(null)
  const projectPickerRef = useRef<HTMLDivElement>(null)

  const settings = useLaunchSettings()
  const selectedProjectConfig = config?.projects.find((p) => p.name === settings.selectedProject)
  const tip = useMemo(() => getRandomTips(1)[0], [])
  const { status: installStatus } = useAgentInstallStatus()

  // Auto-focus textarea
  useEffect(() => {
    if (mode === 'overlay' && isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100)
      settings.reset()
      setPrompt('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode])

  useEffect(() => {
    if (mode === 'inline') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [mode])

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false)
      }
      if (projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node)) {
        setShowProjectPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLaunch = async (): Promise<void> => {
    const project = config?.projects.find((p) => p.name === settings.selectedProject)
    if (!project) return

    setLaunching(true)

    try {
      const isRemote = settings.selectedHost !== 'local'
      const branchChanged =
        settings.selectedBranch && settings.selectedBranch !== settings.currentBranch
      const branchToUse = isRemote
        ? undefined
        : settings.useWorktree
          ? settings.selectedBranch || undefined
          : branchChanged
            ? settings.selectedBranch
            : undefined

      const session = await window.api.createTerminal({
        agentType: settings.selectedAgent,
        projectName: project.name,
        projectPath: project.path,
        branch: branchToUse,
        useWorktree: branchToUse && settings.useWorktree ? true : undefined,
        remoteHostId: isRemote ? settings.selectedHost : undefined,
        initialPrompt: prompt.trim() || undefined
      })

      addTerminal(session)
      settings.persist()
      setPrompt('')
      onClose?.()
    } catch (err) {
      console.error('[PromptLauncher] launch failed:', err)
    } finally {
      setLaunching(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (settings.selectedProject) handleLaunch()
    }
    if (e.key === 'Escape') {
      onClose?.()
    }
  }

  const canLaunch = !!settings.selectedProject

  // --- Settings bar (inside the input box, bottom) — all selectors in sequence ---
  const settingsBar = (
    <div className="flex items-center gap-1">
      {/* Project picker */}
      <div className="relative" ref={projectPickerRef}>
        <button
          onClick={() => setShowProjectPicker(!showProjectPicker)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
            settings.selectedProject
              ? 'text-gray-300 hover:bg-white/[0.06]'
              : 'text-gray-500 hover:bg-white/[0.06]'
          }`}
        >
          <ProjectIcon project={selectedProjectConfig} size={13} />
          <span className="text-xs truncate max-w-[140px]">
            {settings.selectedProject || 'Select project'}
          </span>
          <ChevronDown size={10} />
        </button>
        {showProjectPicker && (
          <div className="absolute bottom-full left-0 mb-1" style={{ background: '#1e1e22' }}>
            <div
              className="border border-white/[0.08] rounded-lg shadow-xl z-20 py-1
                            min-w-[240px] max-h-[280px] overflow-y-auto"
            >
              {settings.filteredProjects.map((project) => (
                <button
                  key={project.name}
                  onClick={() => {
                    settings.setSelectedProject(project.name)
                    setShowProjectPicker(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5
                             hover:bg-white/[0.06] transition-colors ${
                               settings.selectedProject === project.name
                                 ? 'text-white bg-white/[0.04]'
                                 : 'text-gray-400'
                             }`}
                >
                  <ProjectIcon project={project} size={14} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{project.name}</div>
                    <div className="text-[10px] text-gray-600 truncate">{project.path}</div>
                  </div>
                </button>
              ))}
              {settings.filteredProjects.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-600">No projects</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agent picker */}
      <div className="relative" ref={agentPickerRef}>
        <button
          onClick={() => setShowAgentPicker(!showAgentPicker)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md
                     hover:bg-white/[0.06] transition-colors text-gray-400"
        >
          <AgentIcon agentType={settings.selectedAgent} size={14} />
          <span className="text-xs">
            {AGENT_LIST.find((a) => a.type === settings.selectedAgent)?.displayName}
          </span>
          <ChevronDown size={10} />
        </button>
        {showAgentPicker && (
          <div
            className="absolute bottom-full left-0 mb-1 border border-white/[0.08]
                          rounded-lg shadow-xl z-20 py-1 min-w-[160px]"
            style={{ background: '#1e1e22' }}
          >
            {AGENT_LIST.map((agent) => {
              const installed = installStatus[agent.type]
              return (
                <button
                  key={agent.type}
                  onClick={() => {
                    if (!installed) return
                    settings.setSelectedAgent(agent.type as AgentType)
                    setShowAgentPicker(false)
                  }}
                  disabled={!installed}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2
                             transition-colors ${
                               !installed
                                 ? 'opacity-35 cursor-not-allowed text-gray-600'
                                 : settings.selectedAgent === agent.type
                                   ? 'text-white bg-white/[0.04]'
                                   : 'text-gray-400 hover:bg-white/[0.06]'
                             }`}
                  title={!installed ? `${agent.displayName} is not installed` : undefined}
                >
                  <AgentIcon agentType={agent.type} size={14} />
                  {agent.displayName}
                  {!installed && (
                    <span className="ml-auto text-[9px] text-gray-600">Not installed</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Branch picker — only for local with branches */}
      {settings.selectedHost === 'local' &&
        settings.activeProjectPath &&
        settings.localBranches.length > 0 && (
          <div className="relative" ref={settings.dropdownRef}>
            <button
              onClick={() => settings.setShowBranchDropdown(!settings.showBranchDropdown)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md
                       hover:bg-white/[0.06] transition-colors text-gray-400"
            >
              <GitBranch size={12} />
              <span className="text-xs truncate max-w-[100px]">
                {settings.loadingBranches ? 'Loading...' : settings.selectedBranch || 'branch'}
              </span>
              <ChevronDown size={10} />
            </button>
            {settings.showBranchDropdown && (
              <div
                className="absolute bottom-full left-0 mb-1 border border-white/[0.08]
                            rounded-lg shadow-xl z-20 min-w-[220px] max-h-[240px] overflow-y-auto"
                style={{ background: '#1e1e22' }}
              >
                <div className="p-2 border-b border-white/[0.06] flex items-center gap-1">
                  <input
                    ref={settings.branchInputRef}
                    type="text"
                    value={settings.branchFilter}
                    onChange={(e) => settings.setBranchFilter(e.target.value)}
                    placeholder="Filter branches..."
                    className="flex-1 px-2 py-1 bg-transparent text-xs text-gray-200
                             placeholder-gray-600 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={settings.handleFetchRemotes}
                    disabled={settings.loadingRemotes}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Fetch remotes"
                  >
                    {settings.loadingRemotes ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <RefreshCw size={10} />
                    )}
                  </button>
                </div>
                <div className="py-1">
                  {settings.filteredBranches.map((b) => (
                    <button
                      key={`${b.name}-${b.isRemote}`}
                      onClick={() => {
                        settings.setSelectedBranch(b.name)
                        settings.setShowBranchDropdown(false)
                        settings.setBranchFilter('')
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2
                               hover:bg-white/[0.06] transition-colors ${
                                 settings.selectedBranch === b.name
                                   ? 'text-white bg-white/[0.04]'
                                   : 'text-gray-400'
                               }`}
                    >
                      <GitBranch
                        size={10}
                        className={b.isRemote ? 'text-blue-400' : 'text-gray-500'}
                      />
                      <span className="truncate">{b.name}</span>
                      {b.isRemote && (
                        <span className="text-[9px] text-blue-400/60 ml-auto">remote</span>
                      )}
                      {b.name === settings.currentBranch && (
                        <span className="text-[9px] text-green-400/60 ml-auto">current</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Worktree toggle */}
      {settings.selectedHost === 'local' &&
        settings.activeProjectPath &&
        settings.localBranches.length > 0 && (
          <button
            onClick={() => settings.setUseWorktree(!settings.useWorktree)}
            className={`p-1.5 rounded-md transition-all ${
              settings.useWorktree
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.04]'
            }`}
            title={settings.useWorktree ? 'Worktree enabled' : 'Create worktree'}
          >
            <FolderGit2 size={13} strokeWidth={1.5} />
          </button>
        )}

      {/* Host selector — only if remote hosts exist */}
      {settings.remoteHosts.length > 0 && (
        <>
          <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
          <button
            onClick={() => settings.setSelectedHost('local')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              settings.selectedHost === 'local'
                ? 'text-gray-300 bg-white/[0.06]'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <Terminal size={11} />
            Local
          </button>
          {settings.remoteHosts.map((host) => (
            <button
              key={host.id}
              onClick={() => settings.setSelectedHost(host.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                settings.selectedHost === host.id
                  ? 'bg-blue-500/10 text-blue-300'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <Server size={11} />
              {host.label}
            </button>
          ))}
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Send button */}
      <button
        onClick={handleLaunch}
        disabled={!canLaunch || launching}
        className={`p-1.5 rounded-full transition-colors ${
          canLaunch
            ? 'text-black cursor-pointer'
            : 'bg-white/[0.06] text-gray-600 cursor-not-allowed'
        }`}
        style={canLaunch ? { background: '#00FFD4' } : undefined}
        onMouseEnter={(e) => {
          if (canLaunch) e.currentTarget.style.background = '#00e6be'
        }}
        onMouseLeave={(e) => {
          if (canLaunch) e.currentTarget.style.background = '#00FFD4'
        }}
        title="Launch (Enter)"
      >
        <ArrowUp size={14} strokeWidth={2.5} />
      </button>
    </div>
  )

  // --- Prompt input block (shared between inline and overlay) ---
  const promptInput = (
    <div className="w-full">
      <div
        className="relative rounded-xl border border-white/[0.1] bg-[#232326]
                      focus-within:border-white/[0.18] transition-colors"
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your task..."
          rows={3}
          className="w-full px-4 pt-4 pb-12 bg-transparent text-sm text-gray-200
                     placeholder-gray-600 focus:outline-none resize-none"
        />
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 border-t border-white/[0.04]">
          {settingsBar}
        </div>
      </div>
      {!canLaunch ? (
        <p className="text-[11px] text-gray-600 mt-2 text-center">
          Select a project to get started
        </p>
      ) : (
        <p className="text-[11px] text-gray-600 mt-2 text-center flex items-center justify-center gap-1.5">
          <Lightbulb size={11} className="text-yellow-500/60 shrink-0" />
          {tip.shortcut && (
            <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-gray-500 font-mono text-[10px]">
              {tip.shortcut}
            </kbd>
          )}
          {tip.text}
        </p>
      )}
    </div>
  )

  // --- Inline mode ---
  if (mode === 'inline') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full px-4">
        <div className="w-full max-w-[800px] flex flex-col items-center">
          <img
            src={vibegridLogo}
            alt="VibeGrid"
            className="h-8 mb-5 opacity-40"
            draggable={false}
          />
          <p className="text-sm text-gray-500 mb-6">Describe a task to start a coding agent</p>
          {promptInput}
        </div>
      </div>
    )
  }

  // --- Overlay mode ---
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed top-1/2 left-1/2 z-50 w-[92%] sm:w-[80%] max-w-[800px] border border-white/[0.08]
                       rounded-xl shadow-2xl p-4 sm:p-6"
            style={{ background: '#1e1e22' }}
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {promptInput}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
