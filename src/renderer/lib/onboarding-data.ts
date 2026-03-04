const isMac = navigator.platform.toUpperCase().includes('MAC')
const MOD = isMac ? '\u2318' : 'Ctrl+'

export interface OnboardingTopic {
  id: string
  title: string
  section: string
  description: string
  icon: string // Lucide icon name
  shortcutHint?: string
}

export const ONBOARDING_SECTIONS = [
  { key: 'getting-started', label: 'Getting Started' },
  { key: 'core-features', label: 'Core Features' },
  { key: 'advanced', label: 'Advanced' }
] as const

export const ONBOARDING_TOPICS: OnboardingTopic[] = [
  {
    id: 'welcome',
    title: 'Welcome to VibeGrid',
    section: 'getting-started',
    description:
      'VibeGrid is your AI agent terminal manager. Launch multiple AI coding agents side-by-side, monitor their progress in a grid view, and manage all your projects from one place. Use this guide to learn the key features and get productive fast.',
    icon: 'LayoutGrid'
  },
  {
    id: 'command-bar',
    title: 'Command Bar',
    section: 'getting-started',
    description:
      'Quickly access any action with the command palette. Search for commands, switch between sessions, launch new agents, or jump to projects \u2014 all from a single search bar. It\u2019s the fastest way to navigate VibeGrid.',
    icon: 'Search',
    shortcutHint: `${MOD}K`
  },
  {
    id: 'context-bar',
    title: 'Context Bar',
    section: 'core-features',
    description:
      `The top toolbar shows your active agent count, filter controls, and grid settings. Use it to filter agents by status (running, waiting, idle, error), change the sort order, or adjust the grid layout. Status filters also have keyboard shortcuts: ${MOD}1 through ${MOD}5.`,
    icon: 'SlidersHorizontal'
  },
  {
    id: 'workspace-sidebar',
    title: 'Workspace Sidebar',
    section: 'core-features',
    description:
      'The left sidebar organizes your projects and workflows. Click a project to filter the grid to that project\u2019s sessions. Expand projects to see individual agents. Add custom workflows to launch multi-agent setups with one click.',
    icon: 'PanelLeft',
    shortcutHint: `${MOD}B`
  },
  {
    id: 'multi-repo',
    title: 'Multi-Repo Support',
    section: 'core-features',
    description:
      'Add multiple projects from your filesystem. Each project tracks its own sessions, branches, and worktrees independently. You can also configure remote hosts in Settings to run agents on other machines via SSH.',
    icon: 'FolderTree'
  },
  {
    id: 'multiple-sessions',
    title: 'Multiple Sessions',
    section: 'core-features',
    description:
      `Run as many AI agent sessions as you need. Each session gets its own terminal card in the grid. Double-click a card to expand it full-screen, or use ${MOD}] and ${MOD}[ to cycle between them. Cards can be reordered by dragging in manual sort mode.`,
    icon: 'Columns3'
  },
  {
    id: 'preview-changes',
    title: 'Preview Changes',
    section: 'advanced',
    description:
      'See a live summary of git changes each agent has made. The diff indicator on each card shows files changed, insertions, and deletions at a glance. VibeGrid polls for git changes automatically so you always see the latest state.',
    icon: 'GitCompareArrows'
  },
  {
    id: 'diffs-comments',
    title: 'Diffs and Comments',
    section: 'advanced',
    description:
      'Click the diff indicator on any card to open a full diff sidebar with file-by-file changes. Review what your AI agents have done, then commit and push directly from the commit dialog without leaving VibeGrid.',
    icon: 'FileDiff'
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    section: 'advanced',
    description:
      'VibeGrid is built for keyboard-first workflows. Nearly every action has a shortcut. Open the shortcuts panel anytime to see all available keybindings, from navigation to filters to session management.',
    icon: 'Keyboard',
    shortcutHint: `${MOD}/`
  }
]
