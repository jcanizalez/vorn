import { useState } from 'react'
import { Eye, Pencil } from 'lucide-react'

function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-xs font-semibold text-gray-300 mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-semibold text-gray-200 mt-3 mb-1">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-200">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-white/[0.06] rounded text-[11px] font-mono text-gray-300">$1</code>')
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/\n?```$/, '')
      return `<pre class="px-2 py-1.5 bg-white/[0.04] rounded-md text-[11px] font-mono text-gray-300 overflow-x-auto my-1">${code}</pre>`
    })
    // Checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-center gap-1.5 py-0.5"><span class="text-green-400">&#10003;</span><span class="text-gray-300 line-through">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-center gap-1.5 py-0.5"><span class="text-gray-600">&#9744;</span><span class="text-gray-300">$1</span></div>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<div class="flex items-start gap-1.5 py-0.5"><span class="text-gray-600 mt-0.5">&#8226;</span><span class="text-gray-400">$1</span></div>')
    // Ordered lists
    .replace(/^(\d+)\. (.+)$/gm, '<div class="flex items-start gap-1.5 py-0.5"><span class="text-gray-600">$1.</span><span class="text-gray-400">$2</span></div>')
    // Line breaks
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, '<br />')
}

export const TASK_TEMPLATE = `## Description
Describe what needs to be done...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
Any additional context or references.
`

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
  className = ''
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 mb-1.5">
        <button
          onClick={() => setMode('write')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
            mode === 'write'
              ? 'bg-white/[0.08] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Pencil size={11} strokeWidth={2} />
          Write
        </button>
        <button
          onClick={() => setMode('preview')}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
            mode === 'preview'
              ? 'bg-white/[0.08] text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Eye size={11} strokeWidth={2} />
          Preview
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                     text-gray-200 placeholder-gray-600 focus:border-white/[0.15] focus:outline-none
                     resize-none font-mono leading-relaxed"
        />
      ) : (
        <div
          className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm
                     text-gray-400 overflow-auto"
          style={{ minHeight: `${rows * 1.5 + 1.5}rem` }}
          dangerouslySetInnerHTML={{
            __html: value.trim()
              ? renderMarkdown(value)
              : '<span class="text-gray-600">Nothing to preview</span>'
          }}
        />
      )}
    </div>
  )
}

export function MarkdownPreview({ content, className = '' }: { content: string; className?: string }) {
  if (!content.trim()) return null
  return (
    <div
      className={`text-xs text-gray-400 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}
