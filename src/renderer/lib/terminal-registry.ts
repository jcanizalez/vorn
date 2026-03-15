import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalEntry {
  term: Terminal
  fitAddon: FitAddon
  removeDataListener: () => void
  currentContainer: HTMLDivElement | null
  _loadRenderer?: (() => void) | null
}

export interface TerminalViewportState {
  line: number
  atBottom: boolean
}

const registry = new Map<string, TerminalEntry>()
const readyCallbacks = new Map<string, Set<() => void>>()

const TERM_OPTIONS = {
  cursorBlink: true,
  fontSize: 13,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
  theme: {
    background: '#141416',
    foreground: '#d4d4d8',
    cursor: '#d4d4d8',
    selectionBackground: '#3f3f46',
    black: '#27272a',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#d4d4d8',
    brightBlack: '#52525b',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#facc15',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#fafafa'
  },
  scrollback: 10000,
  allowProposedApi: true
}

/** Allow overriding default font size from config */
let configFontSize = 13
export function setDefaultFontSize(size: number): void {
  configFontSize = size
}

const rendererIsMac = navigator.platform.toUpperCase().includes('MAC')

function createTerminalEntry(terminalId: string): TerminalEntry {
  const term = new Terminal({ ...TERM_OPTIONS, fontSize: configFontSize })
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  // Let app-level shortcuts pass through instead of being consumed by xterm
  term.attachCustomKeyEventHandler((e) => {
    const mod = rendererIsMac ? e.metaKey : e.ctrlKey
    if (!mod) return true

    // Handle paste on Windows/Linux — Ctrl+V is intercepted by xterm as a
    // control character (\x16) instead of triggering the browser paste event.
    // Read clipboard manually and use term.paste() for bracketed-paste support.
    if (!rendererIsMac && e.key.toLowerCase() === 'v' && e.type === 'keydown') {
      navigator.clipboard.readText().then((text) => {
        if (text) term.paste(text)
      })
      return false
    }

    const passthrough = ['w', '[', ']', 'k', 'n', 'o', 'b', ',', '/']
    if (passthrough.includes(e.key.toLowerCase())) return false
    return true
  })

  // Try WebGL, fall back to canvas (loaded after open())
  const loadRenderer = (): void => {
    import('@xterm/addon-webgl')
      .then(({ WebglAddon }) => {
        try {
          term.loadAddon(new WebglAddon())
        } catch {
          import('@xterm/addon-canvas').then(({ CanvasAddon }) => {
            term.loadAddon(new CanvasAddon())
          })
        }
      })
      .catch(() => {
        import('@xterm/addon-canvas').then(({ CanvasAddon }) => {
          term.loadAddon(new CanvasAddon())
        })
      })
  }

  // Forward keystrokes to pty
  term.onData((data) => {
    window.api.writeTerminal(terminalId, data)
  })

  // Receive pty output
  const removeDataListener = window.api.onTerminalData(({ id, data }) => {
    if (id === terminalId) term.write(data)
  })

  const entry: TerminalEntry = {
    term,
    fitAddon,
    removeDataListener,
    currentContainer: null
  }

  // Store a flag so we only load renderer once after first open
  entry._loadRenderer = loadRenderer

  registry.set(terminalId, entry)

  const cbs = readyCallbacks.get(terminalId)
  if (cbs) {
    cbs.forEach((cb) => cb())
    readyCallbacks.delete(terminalId)
  }

  return entry
}

/**
 * Attach a terminal to a container. If the terminal doesn't exist yet,
 * it's created. If it's already attached elsewhere, its DOM is moved.
 */
export function attachTerminal(terminalId: string, container: HTMLDivElement): TerminalEntry {
  let entry = registry.get(terminalId)

  if (!entry) {
    entry = createTerminalEntry(terminalId)
    // First time — open into this container
    entry.term.open(container)
    entry.currentContainer = container
    // Load GPU renderer after open
    entry._loadRenderer?.()
    entry._loadRenderer = null
    setTimeout(() => entry!.fitAddon.fit(), 0)
    return entry
  }

  // Already exists — skip if already attached to the same container
  if (entry.currentContainer === container) {
    return entry
  }

  // Move the DOM element to a different container
  const termEl = entry.term.element
  if (termEl) {
    container.innerHTML = ''
    container.appendChild(termEl)
  }
  entry.currentContainer = container

  return entry
}

/**
 * Detach a terminal from its current container (e.g. on component unmount).
 * Does NOT dispose — the terminal stays alive in the registry.
 */
export function detachTerminal(terminalId: string, container: HTMLDivElement): void {
  const entry = registry.get(terminalId)
  if (entry && entry.currentContainer === container) {
    entry.currentContainer = null
  }
}

/**
 * Fit the terminal to its current container and notify the pty of new size.
 */
export function fitTerminal(terminalId: string, preState?: TerminalViewportState | null): void {
  const entry = registry.get(terminalId)
  if (!entry || !entry.currentContainer) return
  // Only capture/restore viewport state if we were given one (e.g. after a DOM move).
  // Otherwise let xterm.js handle scroll naturally — it already auto-scrolls when at bottom
  // and holds position when the user has scrolled up.
  const viewportState = preState !== undefined ? preState : null
  try {
    entry.fitAddon.fit()
    if (viewportState) restoreViewportState(terminalId, viewportState)
    const { cols, rows } = entry.term
    window.api.resizeTerminal({ id: terminalId, cols, rows })
  } catch {
    // fit can throw if container has 0 dimensions
  }
}

/**
 * Focus the terminal (keyboard input).
 */
export function focusTerminal(terminalId: string): void {
  registry.get(terminalId)?.term.focus()
}

export function getViewportState(terminalId: string): TerminalViewportState | null {
  const entry = registry.get(terminalId)
  if (!entry) return null
  const buf = entry.term.buffer.active
  return {
    line: buf.viewportY,
    atBottom: buf.viewportY >= buf.baseY
  }
}

export function restoreViewportState(terminalId: string, state: TerminalViewportState): void {
  const entry = registry.get(terminalId)
  if (!entry) return
  if (state.atBottom) {
    entry.term.scrollToBottom()
    return
  }
  entry.term.scrollToLine(Math.max(0, state.line))
}

export function scrollToBottom(terminalId: string): void {
  const entry = registry.get(terminalId)
  if (!entry) return
  entry.term.scrollToBottom()
}

export function isAtBottom(terminalId: string): boolean {
  const entry = registry.get(terminalId)
  if (!entry) return true
  const buf = entry.term.buffer.active
  return buf.viewportY >= buf.baseY
}

export function onTerminalReady(terminalId: string, callback: () => void): () => void {
  if (registry.has(terminalId)) {
    callback()
    return () => {}
  }
  if (!readyCallbacks.has(terminalId)) readyCallbacks.set(terminalId, new Set())
  readyCallbacks.get(terminalId)!.add(callback)
  return () => {
    readyCallbacks.get(terminalId)?.delete(callback)
  }
}

export function onTerminalScroll(
  terminalId: string,
  callback: () => void
): (() => void) | undefined {
  const entry = registry.get(terminalId)
  if (!entry) return undefined
  const scrollDisposable = entry.term.onScroll(callback)
  let writeTimer: ReturnType<typeof setTimeout> | null = null
  const writeDisposable = entry.term.onWriteParsed(() => {
    if (writeTimer) return
    writeTimer = setTimeout(() => {
      writeTimer = null
      callback()
    }, 300)
  })
  return () => {
    scrollDisposable.dispose()
    writeDisposable.dispose()
    if (writeTimer) clearTimeout(writeTimer)
  }
}

/**
 * Fully destroy a terminal (when killing an agent).
 */
export function destroyTerminal(terminalId: string): void {
  const entry = registry.get(terminalId)
  if (!entry) return
  entry.removeDataListener()
  entry.term.dispose()
  registry.delete(terminalId)
  readyCallbacks.delete(terminalId)
}

/**
 * Update font size on all terminals and re-fit them.
 */
export function setAllTerminalsFontSize(fontSize: number): void {
  for (const [id, entry] of registry) {
    entry.term.options.fontSize = fontSize
    fitTerminal(id)
  }
}
