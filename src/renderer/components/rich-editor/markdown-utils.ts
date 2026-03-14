/**
 * Markdown <-> TipTap content conversion utilities.
 *
 * markdownToHtml: converts markdown to semantic HTML that TipTap can parse.
 * editorJsonToMarkdown: serializes ProseMirror JSON back to clean markdown.
 */

import type { JSONContent } from '@tiptap/react'

/* ------------------------------------------------------------------ */
/*  Markdown → HTML (for initial content loading into TipTap)         */
/* ------------------------------------------------------------------ */

export function markdownToHtml(md: string): string {
  if (!md.trim()) return ''

  const lines = md.split('\n')
  const htmlParts: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]))
        i++
      }
      i++ // skip closing ```
      const langAttr = lang ? ` class="language-${lang}"` : ''
      htmlParts.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`)
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3}) (.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      htmlParts.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      htmlParts.push('<hr>')
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      htmlParts.push(`<blockquote><p>${inlineMarkdown(quoteLines.join('<br>'))}</p></blockquote>`)
      continue
    }

    // Task list items
    const taskMatch = line.match(/^- \[([ x])\] (.+)$/)
    if (taskMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const tm = lines[i].match(/^- \[([ x])\] (.+)$/)
        if (!tm) break
        const checked = tm[1] === 'x' ? 'true' : 'false'
        items.push(
          `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${tm[1] === 'x' ? ' checked' : ''}><span></span></label><div><p>${inlineMarkdown(tm[2])}</p></div></li>`
        )
        i++
      }
      htmlParts.push(`<ul data-type="taskList">${items.join('')}</ul>`)
      continue
    }

    // Unordered list
    if (/^- .+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^- .+/.test(lines[i])) {
        items.push(`<li><p>${inlineMarkdown(lines[i].slice(2))}</p></li>`)
        i++
      }
      htmlParts.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Ordered list
    if (/^\d+\. .+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. .+/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, '')
        items.push(`<li><p>${inlineMarkdown(text)}</p></li>`)
        i++
      }
      htmlParts.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph
    htmlParts.push(`<p>${inlineMarkdown(line)}</p>`)
    i++
  }

  return htmlParts.join('')
}

/** Escape HTML special characters to prevent XSS injection. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

/* ------------------------------------------------------------------ */
/*  ProseMirror JSON → Markdown                                       */
/* ------------------------------------------------------------------ */

export function editorJsonToMarkdown(doc: JSONContent): string {
  if (!doc.content) return ''
  return serializeNodes(doc.content).trim() + '\n'
}

function serializeNodes(nodes: JSONContent[]): string {
  const parts: string[] = []

  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph':
        parts.push(serializeInline(node.content) + '\n')
        break

      case 'heading': {
        const level = node.attrs?.level ?? 1
        const prefix = '#'.repeat(level)
        parts.push(`${prefix} ${serializeInline(node.content)}\n`)
        break
      }

      case 'bulletList':
        if (node.content) {
          for (const item of node.content) {
            const text = serializeListItemContent(item.content)
            parts.push(`- ${text}\n`)
          }
        }
        break

      case 'orderedList':
        if (node.content) {
          node.content.forEach((item, idx) => {
            const text = serializeListItemContent(item.content)
            parts.push(`${idx + 1}. ${text}\n`)
          })
        }
        break

      case 'taskList':
        if (node.content) {
          for (const item of node.content) {
            const checked = item.attrs?.checked ? 'x' : ' '
            const text = serializeListItemContent(item.content)
            parts.push(`- [${checked}] ${text}\n`)
          }
        }
        break

      case 'codeBlock': {
        const lang = node.attrs?.language || ''
        const code = node.content?.map((n) => n.text ?? '').join('') ?? ''
        parts.push(`\`\`\`${lang}\n${code}\n\`\`\`\n`)
        break
      }

      case 'blockquote':
        if (node.content) {
          const inner = serializeNodes(node.content).trim()
          parts.push(
            inner
              .split('\n')
              .map((l) => `> ${l}`)
              .join('\n') + '\n'
          )
        }
        break

      case 'horizontalRule':
        parts.push('---\n')
        break

      case 'hardBreak':
        parts.push('\n')
        break

      default:
        // Unknown node — try inline serialization
        if (node.content) {
          parts.push(serializeInline(node.content) + '\n')
        }
    }
  }

  // Join and collapse excessive blank lines (max 2 newlines = 1 blank line)
  return parts.join('\n').replace(/\n{3,}/g, '\n\n')
}

function serializeListItemContent(content?: JSONContent[]): string {
  if (!content) return ''
  // List items contain paragraphs — serialize their inline content
  return content
    .map((child) => {
      if (child.type === 'paragraph') return serializeInline(child.content)
      return serializeNodes([child]).trim()
    })
    .join('\n')
}

function serializeInline(nodes?: JSONContent[]): string {
  if (!nodes) return ''
  return nodes.map(serializeInlineNode).join('')
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === 'hardBreak') return '\n'

  let text = node.text ?? ''
  if (!node.marks) return text

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
        text = `**${text}**`
        break
      case 'italic':
        text = `*${text}*`
        break
      case 'strike':
        text = `~~${text}~~`
        break
      case 'code':
        text = `\`${text}\``
        break
      case 'link':
        text = `[${text}](${mark.attrs?.href ?? ''})`
        break
    }
  }

  return text
}
