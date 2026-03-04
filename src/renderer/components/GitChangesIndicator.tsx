import { useAppStore } from '../stores'

interface Props {
  terminalId: string
}

export function GitChangesIndicator({ terminalId }: Props) {
  const stat = useAppStore((s) => s.gitDiffStats.get(terminalId))
  const setDiffSidebar = useAppStore((s) => s.setDiffSidebarTerminalId)

  if (!stat || (stat.insertions === 0 && stat.deletions === 0)) return null

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    setDiffSidebar(terminalId)
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] font-mono
                 bg-white/[0.04] hover:bg-white/[0.08] rounded-md border border-white/[0.06]
                 transition-colors cursor-pointer"
      title={`${stat.filesChanged} file${stat.filesChanged !== 1 ? 's' : ''} changed`}
    >
      <span className="text-green-400">+{stat.insertions}</span>
      <span className="text-red-400">-{stat.deletions}</span>
    </button>
  )
}
