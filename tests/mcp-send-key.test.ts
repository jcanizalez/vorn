import { describe, it, expect } from 'vitest'

/**
 * Tests for the send_key key mapping logic.
 * The KEY_MAP and resolution logic is inlined in sessions.ts inside
 * registerSessionTools(). We replicate it here to unit-test the mapping
 * without spinning up a full MCP server.
 */

const KEY_MAP: Record<string, string> = {
  enter: '\r',
  escape: '\x1b',
  esc: '\x1b',
  tab: '\x09',
  'shift+tab': '\x1b[Z',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  backspace: '\x7f',
  delete: '\x1b[3~',
  home: '\x1b[H',
  end: '\x1b[F',
  'ctrl+c': '\x03',
  'ctrl+d': '\x04',
  'ctrl+x': '\x18',
  'ctrl+z': '\x1a'
}

function resolveKey(rawKey: string): { data: string } | { error: string } {
  const key = rawKey.toLowerCase().trim()

  const data = KEY_MAP[key]
  if (data) return { data }

  const ctrlMatch = key.match(/^ctrl\+([a-z])$/)
  if (ctrlMatch) {
    return { data: String.fromCharCode(ctrlMatch[1].toUpperCase().charCodeAt(0) - 64) }
  }

  if (rawKey.length === 1) return { data: rawKey }

  return { error: `Unknown key: "${rawKey}"` }
}

describe('send_key key mapping', () => {
  describe('named keys', () => {
    it.each([
      ['enter', '\r'],
      ['escape', '\x1b'],
      ['esc', '\x1b'],
      ['tab', '\x09'],
      ['shift+tab', '\x1b[Z'],
      ['up', '\x1b[A'],
      ['down', '\x1b[B'],
      ['left', '\x1b[D'],
      ['right', '\x1b[C'],
      ['backspace', '\x7f'],
      ['delete', '\x1b[3~'],
      ['home', '\x1b[H'],
      ['end', '\x1b[F']
    ])('%s → correct escape sequence', (key, expected) => {
      const result = resolveKey(key)
      expect(result).toEqual({ data: expected })
    })
  })

  describe('ctrl combos', () => {
    it.each([
      ['ctrl+c', '\x03'],
      ['ctrl+d', '\x04'],
      ['ctrl+x', '\x18'],
      ['ctrl+z', '\x1a'],
      ['ctrl+a', '\x01'],
      ['ctrl+l', '\x0c'],
      ['ctrl+w', '\x17']
    ])('%s → correct control character', (key, expected) => {
      const result = resolveKey(key)
      expect(result).toEqual({ data: expected })
    })
  })

  describe('single printable characters', () => {
    it.each(['1', '2', 'y', 'n', 'q', 'Y', 'N'])('%s → sent as-is', (key) => {
      const result = resolveKey(key)
      expect(result).toEqual({ data: key })
    })

    it('preserves case for uppercase single chars', () => {
      expect(resolveKey('Y')).toEqual({ data: 'Y' })
      expect(resolveKey('N')).toEqual({ data: 'N' })
    })
  })

  describe('case insensitivity for named keys', () => {
    it('ENTER resolves same as enter', () => {
      expect(resolveKey('ENTER')).toEqual({ data: '\r' })
    })

    it('Ctrl+C resolves same as ctrl+c', () => {
      expect(resolveKey('Ctrl+C')).toEqual({ data: '\x03' })
    })

    it('handles whitespace around key', () => {
      expect(resolveKey('  up  ')).toEqual({ data: '\x1b[A' })
    })
  })

  describe('unknown keys', () => {
    it.each(['f13', 'super+a', 'alt+tab', 'pageup'])('%s → error', (key) => {
      const result = resolveKey(key)
      expect(result).toHaveProperty('error')
    })
  })
})
