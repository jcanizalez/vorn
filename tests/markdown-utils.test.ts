import { describe, it, expect } from 'vitest'
import { stripMarkdown } from '../src/renderer/lib/markdown-utils'

describe('stripMarkdown', () => {
  it('strips code blocks', () => {
    expect(stripMarkdown('before\n```\ncode\n```\nafter')).toBe('before after')
  })

  it('strips headers', () => {
    expect(stripMarkdown('# Title\n## Subtitle')).toBe('Title Subtitle')
  })

  it('strips bold', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text')
  })

  it('strips italic', () => {
    expect(stripMarkdown('*italic text*')).toBe('italic text')
  })

  it('strips inline code', () => {
    expect(stripMarkdown('use `code` here')).toBe('use code here')
  })

  it('strips checkboxes', () => {
    expect(stripMarkdown('- [x] done\n- [ ] todo')).toBe('done todo')
  })

  it('strips unordered list markers', () => {
    expect(stripMarkdown('- item one\n* item two')).toBe('item one item two')
  })

  it('strips ordered list markers', () => {
    expect(stripMarkdown('1. first\n2. second')).toBe('first second')
  })

  it('collapses multiple newlines', () => {
    expect(stripMarkdown('a\n\n\nb')).toBe('a b')
  })

  it('trims result', () => {
    expect(stripMarkdown('  hello  ')).toBe('hello')
  })
})
