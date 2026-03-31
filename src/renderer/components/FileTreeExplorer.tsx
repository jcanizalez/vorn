import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { FileEntry } from '../../shared/types'
import {
  ChevronRight,
  Loader2,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  Globe,
  Image,
  Settings,
  Palette,
  X
} from 'lucide-react'

type IconDef = { icon: typeof File; color: string }

const CODE_TS: IconDef = { icon: FileCode, color: 'text-blue-400' }
const CODE_JS: IconDef = { icon: FileCode, color: 'text-yellow-300' }
const TEXT: IconDef = { icon: FileText, color: 'text-gray-400' }
const STYLE: IconDef = { icon: Palette, color: 'text-purple-400' }
const CONFIG: IconDef = { icon: Settings, color: 'text-green-400' }
const IMG: IconDef = { icon: Image, color: 'text-pink-400' }
const DEFAULT_FILE_ICON: IconDef = { icon: File, color: 'text-gray-500' }

const EXT_ICONS: Record<string, IconDef> = {
  ts: CODE_TS,
  tsx: CODE_TS,
  js: CODE_JS,
  jsx: CODE_JS,
  mjs: CODE_JS,
  cjs: CODE_JS,
  json: { icon: FileJson, color: 'text-yellow-400' },
  md: TEXT,
  mdx: TEXT,
  txt: TEXT,
  css: STYLE,
  scss: STYLE,
  less: STYLE,
  html: { icon: Globe, color: 'text-orange-400' },
  htm: { icon: Globe, color: 'text-orange-400' },
  yml: CONFIG,
  yaml: CONFIG,
  toml: CONFIG,
  png: IMG,
  jpg: IMG,
  jpeg: IMG,
  gif: IMG,
  svg: IMG,
  webp: IMG,
  ico: IMG
}

function getFileIcon(name: string): IconDef {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext) return DEFAULT_FILE_ICON
  return EXT_ICONS[ext] ?? DEFAULT_FILE_ICON
}

const MAX_PREVIEW_LINES = 2000

function TreeNode({
  entry,
  depth,
  dirCache,
  loadDir,
  selectedFile,
  onSelectFile
}: {
  entry: FileEntry
  depth: number
  dirCache: Map<string, FileEntry[]>
  loadDir: (path: string) => Promise<void>
  selectedFile: string | null
  onSelectFile: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    if (!entry.isDirectory) return
    if (!expanded && !dirCache.has(entry.path)) {
      setLoading(true)
      await loadDir(entry.path)
      setLoading(false)
    }
    setExpanded(!expanded)
  }

  const children = dirCache.get(entry.path)
  const isSelected = !entry.isDirectory && selectedFile === entry.path

  if (entry.isDirectory) {
    const DirIcon = expanded ? FolderOpen : Folder
    return (
      <div>
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] transition-colors hover:bg-white/[0.04]"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {loading ? (
            <Loader2 size={12} className="text-gray-600 animate-spin shrink-0" />
          ) : (
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={`text-gray-600 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
            />
          )}
          <DirIcon size={14} strokeWidth={1.5} className="text-amber-400 shrink-0" />
          <span className="truncate text-gray-300 font-mono">{entry.name}</span>
        </button>
        {expanded && children && (
          <div>
            {children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                dirCache={dirCache}
                loadDir={loadDir}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
            {children.length === 0 && (
              <div
                className="text-[11px] text-gray-600 italic py-1 font-mono"
                style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
              >
                empty
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const { icon: FileIcon, color } = getFileIcon(entry.name)
  return (
    <button
      onClick={() => onSelectFile(entry.path)}
      className={`w-full flex items-center gap-1.5 py-[3px] pr-2 text-left text-[12px] transition-colors
        ${isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
      style={{ paddingLeft: `${8 + depth * 16 + 16}px` }}
    >
      <FileIcon size={13} strokeWidth={1.5} className={`${color} shrink-0`} />
      <span className="truncate text-gray-300 font-mono">{entry.name}</span>
    </button>
  )
}

function FilePreview({
  filePath,
  content,
  onClose
}: {
  filePath: string
  content: string
  onClose: () => void
}) {
  const lines = useMemo(() => content.split('\n'), [content])
  const fileName = filePath.split(/[/\\]/).pop() || filePath
  const capped = lines.length > MAX_PREVIEW_LINES
  const visibleLines = capped ? lines.slice(0, MAX_PREVIEW_LINES) : lines

  return (
    <div className="flex-1 flex flex-col min-h-0 border-t border-white/[0.06]">
      <div
        className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono
                    border-b border-white/[0.06] shrink-0"
        style={{ background: '#1e1e22' }}
      >
        <span className="text-gray-300 flex-1 min-w-0 truncate">{fileName}</span>
        <span className="text-gray-600 text-[11px] shrink-0">{lines.length} lines</span>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-white p-0.5 rounded transition-colors shrink-0"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <pre className="text-[12px] leading-[1.6] font-mono">
          {visibleLines.map((line, i) => (
            <div key={i} className="flex select-text hover:bg-white/[0.02]">
              <span className="w-[40px] shrink-0 text-right pr-3 text-[11px] text-gray-600 select-none">
                {i + 1}
              </span>
              <span className="text-gray-400 px-1 flex-1 whitespace-pre">{line || ' '}</span>
            </div>
          ))}
          {capped && (
            <div className="px-3 py-2 text-[11px] text-gray-600 italic">
              Showing first {MAX_PREVIEW_LINES} of {lines.length} lines
            </div>
          )}
        </pre>
      </div>
    </div>
  )
}

export function FileTreeExplorer({ cwd }: { cwd: string }) {
  const [rootEntries, setRootEntries] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [dirCache, setDirCache] = useState(() => new Map<string, FileEntry[]>())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const activeRequestRef = useRef<string | null>(null)

  useEffect(() => {
    let stale = false
    window.api.listDir(cwd).then((entries) => {
      if (stale) return
      setRootEntries(entries)
      setLoading(false)
    })
    return () => {
      stale = true
    }
  }, [cwd])

  const loadDir = useCallback(async (dirPath: string) => {
    const entries = await window.api.listDir(dirPath)
    setDirCache((prev) => {
      if (prev.has(dirPath)) return prev
      const next = new Map(prev)
      next.set(dirPath, entries)
      return next
    })
  }, [])

  const handleSelectFile = useCallback(async (filePath: string) => {
    if (filePath === activeRequestRef.current) return
    activeRequestRef.current = filePath
    setSelectedFile(filePath)
    setFileLoading(true)
    const content = await window.api.readFileContent(filePath)
    // Guard against stale responses from rapid clicks
    if (activeRequestRef.current !== filePath) return
    setFileContent(content)
    setFileLoading(false)
  }, [])

  const handleClosePreview = useCallback(() => {
    activeRequestRef.current = null
    setSelectedFile(null)
    setFileContent(null)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!rootEntries || rootEntries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Empty directory
      </div>
    )
  }

  const showPreview = selectedFile && (fileContent !== null || fileLoading)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`overflow-y-auto py-1 ${showPreview ? 'max-h-[50%]' : 'flex-1'}`}>
        {rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            dirCache={dirCache}
            loadDir={loadDir}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
          />
        ))}
      </div>

      {showPreview &&
        (fileLoading ? (
          <div className="flex-1 flex items-center justify-center border-t border-white/[0.06]">
            <Loader2 size={16} className="text-gray-500 animate-spin" />
          </div>
        ) : fileContent !== null ? (
          <FilePreview
            filePath={selectedFile!}
            content={fileContent}
            onClose={handleClosePreview}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center border-t border-white/[0.06] text-gray-600 text-[12px]">
            Binary file — preview unavailable
          </div>
        ))}
    </div>
  )
}
