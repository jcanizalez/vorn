import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

import vscodeSvg from '../assets/icons/vscode.svg?raw'
import cursorSvg from '../assets/icons/cursor.svg?raw'
import windsurfSvg from '../assets/icons/windsurf.svg?raw'
import zedSvg from '../assets/icons/zed.svg?raw'
import sublimeSvg from '../assets/icons/sublime.svg?raw'
import webstormSvg from '../assets/icons/webstorm.svg?raw'
import intellijSvg from '../assets/icons/intellij.svg?raw'
import xcodeSvg from '../assets/icons/xcode.svg?raw'
import terminalSvg from '../assets/icons/terminal.svg?raw'
import finderSvg from '../assets/icons/finder.svg?raw'

interface DetectedIDE {
  id: string
  name: string
  command: string
}

const IDE_ICONS: Record<string, string> = {
  vscode: vscodeSvg,
  'vscode-insiders': vscodeSvg,
  cursor: cursorSvg,
  windsurf: windsurfSvg,
  zed: zedSvg,
  sublime: sublimeSvg,
  webstorm: webstormSvg,
  intellij: intellijSvg,
  xcode: xcodeSvg,
  terminal: terminalSvg,
  finder: finderSvg
}

function IDEIcon({ ideId, size = 14 }: { ideId: string; size?: number }) {
  const svg = IDE_ICONS[ideId]
  if (!svg) return null
  return (
    <span
      className="ide-icon-wrap inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

let ideCache: DetectedIDE[] | null = null

interface Props {
  projectPath: string
  direction?: 'up' | 'down'
}

export function OpenInButton({ projectPath, direction = 'down' }: Props) {
  const [ides, setIdes] = useState<DetectedIDE[]>(ideCache || [])
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ideCache) return
    window.api.detectIDEs().then((detected) => {
      ideCache = detected
      setIdes(detected)
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (ides.length === 0) return null

  const defaultIDE = ides[0]

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.openInIDE(defaultIDE.id, projectPath)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleSelect = (ide: DetectedIDE, e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.openInIDE(ide.id, projectPath)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center">
        <button
          onClick={handleOpen}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-gray-500 hover:text-white
                     bg-white/[0.04] hover:bg-white/[0.08] rounded-l-md border border-white/[0.06]
                     border-r-0 transition-colors"
          title={`Open in ${defaultIDE.name}`}
        >
          <IDEIcon ideId={defaultIDE.id} size={11} />
          <span>Open</span>
        </button>
        <button
          onClick={handleToggle}
          className="flex items-center px-0.5 py-0.5 text-gray-500 hover:text-white
                     bg-white/[0.04] hover:bg-white/[0.08] rounded-r-md border border-white/[0.06]
                     transition-colors"
        >
          <ChevronDown size={10} strokeWidth={2} />
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute right-0 z-50 min-w-[160px] py-1
                     border border-white/[0.08] rounded-lg shadow-xl
                     ${direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ background: '#1e1e22' }}
        >
          <div className="px-3 py-1.5 text-[11px] text-gray-500 font-medium">Open in</div>
          {ides.map((ide) => (
            <button
              key={ide.id}
              onClick={(e) => handleSelect(ide, e)}
              className="w-full px-3 py-1.5 text-left text-[13px] text-gray-300 hover:text-white
                         hover:bg-white/[0.06] flex items-center gap-2.5 transition-colors"
            >
              <IDEIcon ideId={ide.id} size={14} />
              {ide.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
