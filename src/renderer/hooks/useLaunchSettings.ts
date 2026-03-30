import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../stores'
import { AgentType, getProjectHostIds } from '../../shared/types'
import { useShallow } from 'zustand/react/shallow'

export type WorktreeMode = 'none' | 'new' | 'existing'

export interface WorktreeOption {
  path: string
  branch: string
  isMain: boolean
  activeSessionCount: number
}

const STORAGE_KEY = 'vibegrid:lastLaunchSettings'

interface SavedSettings {
  project?: string
  agent?: AgentType
  host?: string
}

function loadSaved(): SavedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function persistSettings(settings: SavedSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function useLaunchSettings() {
  const config = useAppStore((s) => s.config)
  const activeProject = useAppStore((s) => s.activeProject)
  const defaultAgent = config?.defaults.defaultAgent || 'claude'

  const [saved] = useState(loadSaved)
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(saved.agent || defaultAgent)
  const [selectedProject, setSelectedProject] = useState(saved.project || '')
  const [selectedHost, setSelectedHost] = useState(saved.host || 'local')
  const [localBranches, setLocalBranches] = useState<string[]>([])
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [showBranchDropdown, setShowBranchDropdown] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingRemotes, setLoadingRemotes] = useState(false)
  const [worktreeMode, setWorktreeMode] = useState<WorktreeMode>('none')
  const [selectedWorktreePath, setSelectedWorktreePath] = useState<string | null>(null)
  const [existingWorktrees, setExistingWorktrees] = useState<
    { path: string; branch: string; isMain: boolean }[]
  >([])
  const branchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const useWorktree = worktreeMode === 'new'

  const remoteHosts = config?.remoteHosts || []

  // Validate saved project exists in config
  useEffect(() => {
    if (selectedProject && config?.projects) {
      const exists = config.projects.some((p) => p.name === selectedProject)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clear invalid selection when config changes
      if (!exists) setSelectedProject('')
    }
  }, [config?.projects, selectedProject])

  // Sync with sidebar's active project
  useEffect(() => {
    if (activeProject && config?.projects) {
      const exists = config.projects.some((p) => p.name === activeProject)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync UI selection to sidebar state
      if (exists) setSelectedProject(activeProject)
    }
  }, [activeProject, config?.projects])

  // Compute active project path
  const activeProjectPath = config?.projects.find((p) => p.name === selectedProject)?.path || ''

  // Load branches when project changes
  useEffect(() => {
    if (!activeProjectPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset state when project deselected
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

  useEffect(() => {
    if (!activeProjectPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset when project deselected
      setExistingWorktrees([])
      return
    }
    window.api
      .listWorktrees(activeProjectPath)
      .then((wts) => setExistingWorktrees(wts.filter((w) => !w.isMain)))
      .catch(() => setExistingWorktrees([]))
  }, [activeProjectPath])

  // Narrow subscription: only re-render when worktree path counts change
  const worktreePathCounts = useAppStore(
    useShallow((s) => {
      const counts: Record<string, number> = {}
      for (const t of s.terminals.values()) {
        const wp = t.session.worktreePath
        if (wp) counts[wp] = (counts[wp] || 0) + 1
      }
      return counts
    })
  )

  const worktreeOptions: WorktreeOption[] = useMemo(() => {
    return existingWorktrees.map((wt) => ({
      ...wt,
      activeSessionCount: worktreePathCounts[wt.path] || 0
    }))
  }, [existingWorktrees, worktreePathCounts])

  // Close branch dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFetchRemotes = useCallback(async (): Promise<void> => {
    if (!activeProjectPath || loadingRemotes) return
    setLoadingRemotes(true)
    const remotes = await window.api.listRemoteBranches(activeProjectPath)
    const newRemotes = remotes.filter((r) => !localBranches.includes(r))
    setRemoteBranches(newRemotes)
    setLoadingRemotes(false)
  }, [activeProjectPath, loadingRemotes, localBranches])

  const allBranches = useMemo(
    () => [
      ...localBranches.map((b) => ({ name: b, isRemote: false })),
      ...remoteBranches.map((b) => ({ name: b, isRemote: true }))
    ],
    [localBranches, remoteBranches]
  )

  const filteredBranches = useMemo(
    () =>
      branchFilter
        ? allBranches.filter((b) => b.name.toLowerCase().includes(branchFilter.toLowerCase()))
        : allBranches,
    [allBranches, branchFilter]
  )

  // Filtered projects by host
  const filteredProjects = (config?.projects ?? []).filter((p) =>
    getProjectHostIds(p).includes(selectedHost)
  )

  const handleHostChange = useCallback(
    (hostId: string) => {
      setSelectedHost(hostId)
      if (selectedProject) {
        const proj = config?.projects.find((p) => p.name === selectedProject)
        if (proj && !getProjectHostIds(proj).includes(hostId)) setSelectedProject('')
      }
    },
    [selectedProject, config?.projects]
  )

  const handleProjectChange = useCallback((projectName: string) => {
    setSelectedProject(projectName)
  }, [])

  const persist = useCallback(() => {
    persistSettings({ project: selectedProject, agent: selectedAgent, host: selectedHost })
  }, [selectedProject, selectedAgent, selectedHost])

  const firstProject = config?.projects?.[0]?.name || ''

  const reset = useCallback(() => {
    const s = loadSaved()
    setSelectedAgent(s.agent || defaultAgent)
    setSelectedProject(s.project || activeProject || firstProject)
    setSelectedHost(s.host || 'local')
    setLocalBranches([])
    setRemoteBranches([])
    setCurrentBranch(null)
    setSelectedBranch('')
    setBranchFilter('')
    setWorktreeMode('none')
    setSelectedWorktreePath(null)
  }, [defaultAgent, activeProject, firstProject])

  return {
    selectedAgent,
    setSelectedAgent,
    selectedProject,
    setSelectedProject: handleProjectChange,
    selectedHost,
    setSelectedHost: handleHostChange,
    selectedBranch,
    setSelectedBranch,
    branchFilter,
    setBranchFilter,
    showBranchDropdown,
    setShowBranchDropdown,
    loadingBranches,
    loadingRemotes,
    useWorktree,
    worktreeMode,
    setWorktreeMode,
    selectedWorktreePath,
    setSelectedWorktreePath,
    worktreeOptions,
    localBranches,
    remoteBranches,
    currentBranch,
    activeProjectPath,
    filteredBranches,
    filteredProjects,
    remoteHosts,
    handleFetchRemotes,
    branchInputRef,
    dropdownRef,
    persist,
    reset
  }
}
