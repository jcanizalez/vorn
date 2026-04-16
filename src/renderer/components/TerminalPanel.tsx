import { useRef, useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../stores'
import { destroyTerminal } from '../lib/terminal-registry'
import { InlineRename } from './InlineRename'
import { TerminalSlot } from './TerminalSlot'
import { Pencil } from 'lucide-react'

const MIN_HEIGHT = 120
const MAX_HEIGHT_RATIO = 0.7

export function TerminalPanel() {
  const isOpen = useAppStore((s) => s.isTerminalPanelOpen)
  const height = useAppStore((s) => s.terminalPanelHeight)
  const tabs = useAppStore((s) => s.shellTabs)
  const activeTab = useAppStore((s) => s.activeShellTab)
  const setHeight = useAppStore((s) => s.setTerminalPanelHeight)
  const addTab = useAppStore((s) => s.addShellTab)
  const removeTab = useAppStore((s) => s.removeShellTab)
  const setActive = useAppStore((s) => s.setActiveShellTab)
  const renameTab = useAppStore((s) => s.renameShellTab)
  const togglePanel = useAppStore((s) => s.toggleTerminalPanel)
  const activeProject = useAppStore((s) => s.activeProject)
  const config = useAppStore((s) => s.config)

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const createNewTab = useCallback(async () => {
    const project = config?.projects?.find((p) => p.name === activeProject)
    const cwd = project?.path
    const result = await window.api.createShellTerminal(cwd)
    const index = useAppStore.getState().shellTabs.length + 1
    addTab({ id: result.id, title: `Shell ${index}` })
  }, [activeProject, config, addTab])

  // Auto-create first tab when panel opens with no tabs
  useEffect(() => {
    if (isOpen && tabs.length === 0) {
      createNewTab()
    }
  }, [isOpen, tabs.length, createNewTab])

  const closeTab = useCallback(
    (id: string) => {
      window.api.killTerminal(id).catch((err) => {
        console.warn(`[TerminalPanel] killTerminal failed for ${id}:`, err)
      })
      destroyTerminal(id)
      removeTab(id)
    },
    [removeTab]
  )

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startH: height }

      const onMove = (ev: MouseEvent): void => {
        if (!dragRef.current) return
        const delta = dragRef.current.startY - ev.clientY
        const maxH = window.innerHeight * MAX_HEIGHT_RATIO
        const newH = Math.min(maxH, Math.max(MIN_HEIGHT, dragRef.current.startH + delta))
        setHeight(newH)
      }
      const onUp = (): void => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [height, setHeight]
  )

  if (!isOpen) return null

  return (
    <div
      className="shrink-0 flex flex-col border-t border-white/[0.06]"
      style={{ height, background: '#141416' }}
    >
      {/* Drag handle */}
      <div
        className="h-[4px] cursor-row-resize hover:bg-indigo-500/30 transition-colors"
        onMouseDown={onDragStart}
      />

      {/* Tab bar */}
      <div
        className="flex items-center h-[32px] px-2 gap-1 shrink-0 border-b border-white/[0.06]"
        style={{ background: '#1a1a1e' }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group/tab flex items-center gap-1.5 px-2.5 h-[26px] rounded text-[11px] cursor-pointer transition-colors select-none
              ${
                activeTab === tab.id
                  ? 'bg-white/[0.1] text-gray-200'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]'
              }`}
            onClick={() => setActive(tab.id)}
            onDoubleClick={() => setRenamingTabId(tab.id)}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 opacity-50"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            {renamingTabId === tab.id ? (
              <InlineRename
                value={tab.title}
                onCommit={(name) => {
                  renameTab(tab.id, name)
                  setRenamingTabId(null)
                }}
                onCancel={() => setRenamingTabId(null)}
                className="text-[11px] w-[80px]"
              />
            ) : (
              <>
                <span>{tab.title}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Rename tab"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingTabId(tab.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      setRenamingTabId(tab.id)
                    }
                  }}
                  className="opacity-0 group-hover/tab:opacity-100 text-gray-500 hover:text-gray-300 transition-opacity shrink-0 cursor-pointer"
                >
                  <Pencil size={9} />
                </span>
              </>
            )}
            <button
              className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
              style={{ opacity: activeTab === tab.id ? 0.5 : 0 }}
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              title="Close terminal"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}

        {/* Add tab button */}
        <button
          className="flex items-center justify-center w-[26px] h-[26px] rounded text-gray-500
                     hover:text-gray-300 hover:bg-white/[0.05] transition-colors"
          onClick={createNewTab}
          title="New terminal"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 2.5V9.5M2.5 6H9.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="flex-1" />

        {/* Close panel button */}
        <button
          className="flex items-center justify-center w-[26px] h-[26px] rounded text-gray-500
                     hover:text-gray-300 hover:bg-white/[0.05] transition-colors"
          onClick={togglePanel}
          title="Close panel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Terminal area */}
      <div className="flex-1 overflow-hidden">
        {activeTab && (
          <TerminalSlot
            key={activeTab}
            terminalId={activeTab}
            isFocused={true}
            className="w-full h-full"
          />
        )}
      </div>
    </div>
  )
}
