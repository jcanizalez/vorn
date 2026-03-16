import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronDown,
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
} from 'lucide-react'
import { ProjectConfig } from '../../shared/types'

const ICON_MAP: Record<
  string,
  React.FC<{ size?: number; color?: string; strokeWidth?: number }>
> = {
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

function ProjectIcon({ icon, color, size = 13 }: { icon?: string; color?: string; size?: number }) {
  const Icon = icon && ICON_MAP[icon] ? ICON_MAP[icon] : Folder
  return <Icon size={size} color={color || '#6b7280'} strokeWidth={1.5} />
}

export function ProjectPicker({
  currentProject,
  projects,
  onChange
}: {
  currentProject: string
  projects: ProjectConfig[]
  onChange: (projectName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const current = projects.find((p) => p.name === currentProject)

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(true)
  }

  const handleSelect = (name: string) => {
    setOpen(false)
    if (name !== currentProject) {
      onChange(name)
    }
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current && !menuRef.current.contains(target)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleTrigger}
        className="flex items-center gap-1.5 hover:bg-white/[0.04] rounded px-1.5 py-0.5 -mx-1.5 transition-colors text-[12px] text-gray-300"
      >
        <ProjectIcon icon={current?.icon} color={current?.iconColor} />
        <span>{currentProject || 'Select project'}</span>
        <ChevronDown size={11} className="text-gray-500" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="fixed z-[150] rounded-lg border border-white/[0.1] shadow-2xl py-1"
              style={{
                top: position.top,
                left: position.left,
                background: '#1e1e22',
                minWidth: 180
              }}
            >
              {projects.map((p) => (
                <button
                  key={p.name}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(p.name)
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <ProjectIcon icon={p.icon} color={p.iconColor} />
                  <span className="flex-1 text-left">{p.name}</span>
                  {p.name === currentProject && <Check size={13} className="text-gray-400" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
