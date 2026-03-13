import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../stores'
import { AgentType, getProjectHostIds } from '../../shared/types'
import { AGENT_LIST, AGENT_DEFINITIONS } from '../lib/agent-definitions'
import { AgentIcon } from './AgentIcon'
import { useAgentInstallStatus } from '../hooks/useAgentInstallStatus'
import { GitBranch, FolderGit2, RefreshCw, Loader2, Server, Download } from 'lucide-react'

export function NewAgentDialog() {
  const isOpen = useAppStore((s) => s.isNewAgentDialogOpen)
  const setOpen = useAppStore((s) => s.setNewAgentDialogOpen)
  const config = useAppStore((s) => s.config)
  const addTerminal = useAppStore((s) => s.addTerminal)

  const defaultAgent = config?.defaults.defaultAgent || 'claude'
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(defaultAgent)
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [customPath, setCustomPath] = useState('')
  const [sessionName, setSessionName] = useState('')

  // Branch/worktree state
  const [localBranches, setLocalBranches] = useState<string[]>([])
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingRemotes, setLoadingRemotes] = useState(false)
  const [useWorktree, setUseWorktree] = useState(false)
  const [selectedHost, setSelectedHost] = useState('local')
  const branchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const remoteHosts = config?.remoteHosts || []
  const { status: installStatus } = useAgentInstallStatus()

  // Reset to configured default each time dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgent(defaultAgent)
      setSelectedProject('')
      setCustomPath('')
      setSessionName('')
      setLocalBranches([])
      setRemoteBranches([])
      setCurrentBranch(null)
      setSelectedBranch('')
      setBranchFilter('')
      setUseWorktree(false)
      setSelectedHost('local')
    }
  }, [isOpen, defaultAgent])

  // Load branches when project changes
  const activeProjectPath =
    config?.projects.find((p) => p.name === selectedProject)?.path || customPath
  useEffect(() => {
    if (!activeProjectPath) {
      setLocalBranches([])
      setRemoteBranches([])
      setCurrentBranch(null)
      setSelectedBranch('')
      return
    }
    setLoadingBranches(true)
    setRemoteBranches([])
    window.api.listBranches(activeProjectPath).then((result) => {
      setLocalBranches(result.local)
      setCurrentBranch(result.current)
      setSelectedBranch(result.current || '')
      setLoadingBranches(false)
    })
  }, [activeProjectPath])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFetchRemotes = async (): Promise<void> => {
    if (!activeProjectPath || loadingRemotes) return
    setLoadingRemotes(true)
    const remotes = await window.api.listRemoteBranches(activeProjectPath)
    // Filter out branches already in local
    const newRemotes = remotes.filter((r) => !localBranches.includes(r))
    setRemoteBranches(newRemotes)
    setLoadingRemotes(false)
  }

  const allBranches = [
    ...localBranches.map((b) => ({ name: b, isRemote: false })),
    ...remoteBranches.map((b) => ({ name: b, isRemote: true }))
  ]

  const filteredBranches = branchFilter
    ? allBranches.filter((b) => b.name.toLowerCase().includes(branchFilter.toLowerCase()))
    : allBranches

  const handleLaunch = async (): Promise<void> => {
    const project = config?.projects.find((p) => p.name === selectedProject)
    const projectPath = project?.path || customPath || process.cwd()
    const projectName = project?.name || customPath.split('/').pop() || 'untitled'

    // Skip branch/worktree for remote sessions
    const isRemote = selectedHost !== 'local'
    const branchChanged = selectedBranch && selectedBranch !== currentBranch
    const branchToUse = isRemote
      ? undefined
      : useWorktree
        ? selectedBranch || undefined
        : branchChanged
          ? selectedBranch
          : undefined

    const session = await window.api.createTerminal({
      agentType: selectedAgent,
      projectName,
      projectPath,
      displayName: sessionName.trim() || undefined,
      branch: branchToUse,
      useWorktree: branchToUse && useWorktree ? true : undefined,
      remoteHostId: isRemote ? selectedHost : undefined
    })

    addTerminal(session)
    setOpen(false)
    setCustomPath('')
    setSessionName('')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          <motion.div
            className="fixed top-1/2 left-1/2 z-50 w-[520px] border border-white/[0.08]
                       rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            style={{ background: '#1e1e22' }}
            initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] shrink-0">
              <h2 className="text-lg font-medium text-white">New Session</h2>
              <p className="text-sm text-gray-500 mt-0.5">Choose an AI agent and project</p>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Agent selector */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
                  Agent
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AGENT_LIST.map((agent) => {
                    const installed = installStatus[agent.type]
                    const def = AGENT_DEFINITIONS[agent.type]
                    const isSelected = selectedAgent === agent.type

                    return (
                      <button
                        key={agent.type}
                        onClick={() => installed && setSelectedAgent(agent.type)}
                        disabled={!installed}
                        className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200 ${
                          !installed
                            ? 'border-white/[0.03] bg-white/[0.01] cursor-not-allowed'
                            : isSelected
                              ? 'border-white/[0.15] bg-white/[0.06]'
                              : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]'
                        }`}
                        title={
                          !installed
                            ? `${agent.displayName} — install via Settings`
                            : agent.displayName
                        }
                      >
                        {/* Brand accent line for selected agent */}
                        {installed && isSelected && (
                          <div
                            className="absolute inset-x-0 top-0 h-[2px] rounded-t-lg"
                            style={{ background: def.color }}
                          />
                        )}

                        {/* Agent icon with brand bg when selected */}
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            !installed
                              ? 'opacity-30 grayscale'
                              : isSelected
                                ? ''
                                : 'opacity-70 group-hover:opacity-100'
                          }`}
                          style={installed && isSelected ? { background: def.bgColor } : undefined}
                        >
                          <AgentIcon agentType={agent.type} size={22} />
                        </div>

                        <span
                          className={`text-[11px] text-center leading-tight transition-colors ${
                            !installed
                              ? 'text-gray-600'
                              : isSelected
                                ? 'text-gray-200 font-medium'
                                : 'text-gray-400 group-hover:text-gray-300'
                          }`}
                        >
                          {agent.displayName}
                        </span>

                        {/* Not-installed badge */}
                        {!installed && (
                          <span className="flex items-center gap-0.5 text-[9px] text-gray-600 group-hover:text-gray-500 transition-colors">
                            <Download size={8} className="opacity-60" />
                            <span className="group-hover:hidden">Not installed</span>
                            <span className="hidden group-hover:inline">Settings</span>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Host selector — always shown, host-first flow */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block flex items-center gap-2">
                  <Server size={12} />
                  Host
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedHost('local')
                      // Clear project if not available on local
                      if (selectedProject) {
                        const proj = config?.projects.find((p) => p.name === selectedProject)
                        if (proj && !getProjectHostIds(proj).includes('local'))
                          setSelectedProject('')
                      }
                    }}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                      selectedHost === 'local'
                        ? 'border-white/[0.15] bg-white/[0.06] text-white'
                        : 'border-white/[0.04] bg-white/[0.02] text-gray-400 hover:border-white/[0.1]'
                    }`}
                  >
                    Local
                  </button>
                  {remoteHosts.map((host) => (
                    <button
                      key={host.id}
                      onClick={() => {
                        setSelectedHost(host.id)
                        // Clear project if not available on this host
                        if (selectedProject) {
                          const proj = config?.projects.find((p) => p.name === selectedProject)
                          if (proj && !getProjectHostIds(proj).includes(host.id))
                            setSelectedProject('')
                        }
                      }}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                        selectedHost === host.id
                          ? 'border-blue-500/20 bg-blue-500/[0.06] text-blue-300'
                          : 'border-white/[0.04] bg-white/[0.02] text-gray-400 hover:border-white/[0.1]'
                      }`}
                    >
                      <Server
                        size={12}
                        className={selectedHost === host.id ? 'text-blue-400' : 'text-gray-500'}
                      />
                      {host.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project selector — filtered by selected host */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
                  Project
                </label>
                {(() => {
                  const filteredProjects = (config?.projects ?? []).filter((p) =>
                    getProjectHostIds(p).includes(selectedHost)
                  )
                  return filteredProjects.length > 0 ? (
                    <div className="space-y-1.5">
                      {filteredProjects.map((project) => (
                        <button
                          key={project.name}
                          onClick={() => {
                            setSelectedProject(project.name)
                            setCustomPath('')
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                            selectedProject === project.name
                              ? 'border-white/[0.15] bg-white/[0.06]'
                              : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.1]'
                          }`}
                        >
                          <div className="text-sm text-gray-200">{project.name}</div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">
                            {project.path}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 py-1">
                      No projects configured for this host
                    </p>
                  )
                })()}

                {/* Custom path */}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Or enter a custom path..."
                    value={customPath}
                    onChange={(e) => {
                      setCustomPath(e.target.value)
                      setSelectedProject('')
                    }}
                    className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                               text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none"
                  />
                </div>
              </div>

              {/* Branch & Worktree — only shown for local sessions with a project */}
              {activeProjectPath && selectedHost === 'local' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block flex items-center gap-2">
                    <GitBranch size={12} />
                    Branch
                  </label>

                  {loadingBranches ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                      <Loader2 size={12} className="animate-spin" />
                      Loading branches...
                    </div>
                  ) : localBranches.length > 0 ? (
                    <>
                      {/* Branch combobox */}
                      <div className="relative" ref={dropdownRef}>
                        <input
                          ref={branchInputRef}
                          type="text"
                          value={showBranchDropdown ? branchFilter : selectedBranch}
                          onChange={(e) => {
                            setBranchFilter(e.target.value)
                            setShowBranchDropdown(true)
                          }}
                          onFocus={() => {
                            setShowBranchDropdown(true)
                            setBranchFilter('')
                          }}
                          placeholder="Select branch..."
                          className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                                     text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none pr-20"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {currentBranch && selectedBranch === currentBranch && (
                            <span className="text-[10px] text-gray-600 px-1.5 py-0.5 bg-white/[0.04] rounded">
                              current
                            </span>
                          )}
                          <button
                            onClick={handleFetchRemotes}
                            disabled={loadingRemotes}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                            title="Fetch remote branches"
                          >
                            {loadingRemotes ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                          </button>
                        </div>

                        {/* Dropdown */}
                        {showBranchDropdown && filteredBranches.length > 0 && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto
                                          bg-\[#141416\] border border-white/[0.08] rounded-lg shadow-xl z-10"
                          >
                            {filteredBranches.map((b) => (
                              <button
                                key={`${b.name}-${b.isRemote}`}
                                onClick={() => {
                                  setSelectedBranch(b.name)
                                  setShowBranchDropdown(false)
                                  setBranchFilter('')
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors flex items-center gap-2 ${
                                  selectedBranch === b.name
                                    ? 'bg-white/[0.04] text-white'
                                    : 'text-gray-300'
                                }`}
                              >
                                <GitBranch
                                  size={12}
                                  className={b.isRemote ? 'text-blue-400' : 'text-gray-500'}
                                />
                                <span className="truncate">{b.name}</span>
                                {b.isRemote && (
                                  <span className="text-[10px] text-blue-400/60 ml-auto shrink-0">
                                    remote
                                  </span>
                                )}
                                {b.name === currentBranch && (
                                  <span className="text-[10px] text-green-400/60 ml-auto shrink-0">
                                    current
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Worktree toggle */}
                      <div className="mt-3">
                        <button
                          onClick={() => setUseWorktree(!useWorktree)}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border transition-all ${
                            useWorktree
                              ? 'border-amber-500/20 bg-amber-500/[0.06]'
                              : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.1]'
                          }`}
                        >
                          <div
                            className={`w-8 h-[18px] rounded-full transition-colors relative ${
                              useWorktree ? 'bg-amber-500' : 'bg-white/[0.1]'
                            }`}
                          >
                            <div
                              className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
                                useWorktree ? 'translate-x-[16px]' : 'translate-x-[2px]'
                              }`}
                            />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <FolderGit2
                                size={12}
                                className={useWorktree ? 'text-amber-400' : 'text-gray-500'}
                              />
                              <span
                                className={`text-sm ${useWorktree ? 'text-amber-300' : 'text-gray-300'}`}
                              >
                                Create worktree
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              Isolated working directory for this branch
                            </p>
                          </div>
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-600 py-1">Not a git repository</p>
                  )}
                </div>
              )}

              {/* Session name */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
                  Session Name <span className="normal-case text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    selectedProject || customPath.split('/').pop() || 'Uses project name by default'
                  }
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                             text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200
                           bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunch}
                disabled={!selectedProject && !customPath}
                className="px-4 py-2 text-sm font-medium text-white
                           bg-white/[0.1] hover:bg-white/[0.15]
                           disabled:opacity-30 disabled:cursor-not-allowed
                           rounded-lg transition-colors"
              >
                Launch
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
