import { useState, useEffect, useCallback, useMemo, useRef, type JSX } from 'react'
import type { FileEntry } from '../../shared/types'
import { ChevronRight, Loader2, X, Folder, FolderOpen } from 'lucide-react'
import { FileTypeIcon } from './file-icons'

const MAX_PREVIEW_LINES = 2000
const ROW_HEIGHT = 22 // px — matches VS Code's tree item height
const INDENT_WIDTH = 16 // px per depth level
const BASE_LEFT = 8 // px left gutter

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

  // Indent guides: one vertical line per depth level
  const guides = []
  for (let i = 0; i < depth; i++) {
    guides.push(
      <span
        key={i}
        className="absolute top-0 bottom-0 border-l border-white/[0.06] pointer-events-none"
        aria-hidden="true"
        style={{ left: `${BASE_LEFT + 7 + i * INDENT_WIDTH}px` }}
      />
    )
  }

  if (entry.isDirectory) {
    return (
      <div>
        <button
          onClick={handleToggle}
          className="group relative w-full flex items-center gap-[5px] pr-2 text-left text-[12px] transition-colors hover:bg-white/[0.05]"
          style={{ height: ROW_HEIGHT, paddingLeft: `${BASE_LEFT + depth * INDENT_WIDTH}px` }}
        >
          {guides}
          {loading ? (
            <Loader2
              size={14}
              className="text-gray-600 animate-spin shrink-0"
              style={{ width: 14, height: 14 }}
            />
          ) : (
            <ChevronRight
              size={14}
              strokeWidth={2}
              className={`text-gray-500 shrink-0 transition-transform duration-100 ${expanded ? 'rotate-90' : ''}`}
              style={{ width: 14, height: 14 }}
            />
          )}
          {expanded ? (
            <FolderOpen size={14} strokeWidth={1.2} className="text-gray-500 shrink-0" />
          ) : (
            <Folder size={14} strokeWidth={1.2} className="text-gray-500 shrink-0" />
          )}
          <span className="truncate text-gray-300 leading-none">{entry.name}</span>
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
                className="relative text-[11px] text-gray-600 italic leading-none flex items-center"
                style={{
                  height: ROW_HEIGHT,
                  paddingLeft: `${BASE_LEFT + (depth + 1) * INDENT_WIDTH + 16}px`
                }}
              >
                {/* Indent guides for empty message */}
                {[
                  ...guides,
                  <span
                    key={depth}
                    className="absolute top-0 bottom-0 border-l border-white/[0.06] pointer-events-none"
                    aria-hidden="true"
                    style={{ left: `${BASE_LEFT + 7 + depth * INDENT_WIDTH}px` }}
                  />
                ]}
                empty
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelectFile(entry.path)}
      className={`group relative w-full flex items-center gap-[5px] pr-2 text-left text-[12px] transition-colors
        ${isSelected ? 'bg-blue-500/[0.12] text-gray-100' : 'hover:bg-white/[0.05] text-gray-400'}`}
      style={{ height: ROW_HEIGHT, paddingLeft: `${BASE_LEFT + depth * INDENT_WIDTH + 16}px` }}
    >
      {guides}
      <FileTypeIcon name={entry.name} size={16} />
      <span
        className={`truncate leading-none ${isSelected ? 'text-gray-200' : 'text-gray-400 group-hover:text-gray-300'}`}
      >
        {entry.name}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Shiki syntax highlighting
// ---------------------------------------------------------------------------
const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  json5: 'json5',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  md: 'markdown',
  mdx: 'mdx',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  rb: 'ruby',
  php: 'php',
  lua: 'lua',
  zig: 'zig',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cxx: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  xml: 'xml',
  svg: 'xml',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  r: 'r',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  prisma: 'prisma',
  tf: 'hcl',
  ps1: 'powershell',
  bat: 'batch'
}

const FILENAME_TO_LANG: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  '.gitignore': 'gitignore',
  '.env': 'dotenv'
}

function getLang(name: string): string | undefined {
  const lower = name.toLowerCase()
  if (FILENAME_TO_LANG[lower]) return FILENAME_TO_LANG[lower]
  const ext = lower.includes('.') ? lower.split('.').pop()! : undefined
  return ext ? EXT_TO_LANG[ext] : undefined
}

type TokenLine = { content: string; color?: string }[]

type Highlighter = Awaited<ReturnType<typeof import('shiki').createHighlighter>>
let highlighterPromise: Promise<Highlighter> | null = null
const loadedLangs = new Set<string>()

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((m) =>
      m.createHighlighter({
        themes: ['vitesse-dark'],
        langs: [],
        engine: m.createJavaScriptRegexEngine()
      })
    )
  }
  return highlighterPromise
}

async function highlightCode(code: string, lang: string): Promise<TokenLine[]> {
  const hl = await getHighlighter()
  if (!loadedLangs.has(lang)) {
    try {
      await hl.loadLanguage(lang as Parameters<typeof hl.loadLanguage>[0])
      loadedLangs.add(lang)
    } catch {
      return []
    }
  }
  const result = hl.codeToTokens(code, {
    lang: lang as Parameters<typeof hl.codeToTokens>[1]['lang'],
    theme: 'vitesse-dark'
  })
  return result.tokens.map((line) => line.map((t) => ({ content: t.content, color: t.color })))
}

function useHighlightedLines(text: string, fileName: string): TokenLine[] | null {
  const [result, setResult] = useState<{ key: string; tokens: TokenLine[] } | null>(null)
  const lang = getLang(fileName)
  const key = `${fileName}\0${text.length}`

  useEffect(() => {
    if (!lang) return

    let stale = false
    highlightCode(text, lang)
      .then((tokens) => {
        if (stale) return
        setResult(tokens.length > 0 ? { key, tokens } : null)
      })
      .catch(() => {
        if (!stale) setResult(null)
      })

    return () => {
      stale = true
    }
  }, [text, lang, key])

  // Only return tokens if they match the current file
  if (!lang || !result || result.key !== key) return null
  return result.tokens
}

function LineRow({ lineNum, children }: { lineNum: number; children: React.ReactNode }) {
  return (
    <div className="flex select-text hover:bg-white/[0.02]">
      <span className="w-[40px] shrink-0 text-right pr-3 text-[11px] text-gray-600 select-none">
        {lineNum}
      </span>
      {children}
    </div>
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
  const allLines = useMemo(() => content.split('\n'), [content])
  const fileName = filePath.split(/[/\\]/).pop() || filePath
  const capped = allLines.length > MAX_PREVIEW_LINES
  const visibleText = useMemo(
    () => (capped ? allLines.slice(0, MAX_PREVIEW_LINES).join('\n') : content),
    [allLines, capped, content]
  )
  const highlighted = useHighlightedLines(visibleText, fileName)

  const renderedLines = useMemo<JSX.Element[]>(() => {
    if (highlighted) {
      return highlighted.map((tokens, i) => (
        <LineRow key={i} lineNum={i + 1}>
          <span className="px-1 flex-1 whitespace-pre">
            {tokens.map((t, j) => (
              <span key={j} style={t.color ? { color: t.color } : undefined}>
                {t.content}
              </span>
            ))}
            {tokens.length === 0 && ' '}
          </span>
        </LineRow>
      ))
    }

    const plain = capped ? allLines.slice(0, MAX_PREVIEW_LINES) : allLines
    return plain.map((line, i) => (
      <LineRow key={i} lineNum={i + 1}>
        <span className="text-gray-400 px-1 flex-1 whitespace-pre">{line || ' '}</span>
      </LineRow>
    ))
  }, [allLines, capped, highlighted])

  return (
    <div className="flex-1 flex flex-col min-h-0 border-t border-white/[0.06]">
      <div
        className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-[12px] font-mono
                    border-b border-white/[0.06] shrink-0"
        style={{ background: '#1e1e22' }}
      >
        <FileTypeIcon name={fileName} size={14} />
        <span className="text-gray-300 flex-1 min-w-0 truncate">{fileName}</span>
        <span className="text-gray-600 text-[11px] shrink-0">{allLines.length} lines</span>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-white p-0.5 rounded transition-colors shrink-0"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <pre className="text-[12px] leading-[1.6] font-mono">
          {renderedLines}
          {capped && (
            <div className="px-3 py-2 text-[11px] text-gray-600 italic">
              Showing first {MAX_PREVIEW_LINES} of {allLines.length} lines
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
      <div className={`overflow-y-auto py-0.5 ${showPreview ? 'max-h-[50%]' : 'flex-1'}`}>
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
