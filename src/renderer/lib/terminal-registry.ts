import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalEntry {
  term: Terminal
  fitAddon: FitAddon
  removeDataListener: () => void
  currentContainer: HTMLDivElement | null
}

const registry = new Map<string, TerminalEntry>()

const TERM_OPTIONS = {
  cursorBlink: true,
  fontSize: 13,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
  theme: {
    background: '#0f172a',
    foreground: '#e2e8f0',
    cursor: '#e2e8f0',
    selectionBackground: '#334155',
    black: '#1e293b',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#e2e8f0',
    brightBlack: '#475569',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#facc15',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#f8fafc'
  },
  scrollback: 10000,
  allowProposedApi: true
}

/** Allow overriding default font size from config */
let configFontSize = 13
export function setDefaultFontSize(size: number): void {
  configFontSize = size
}

function createTerminalEntry(terminalId: string): TerminalEntry {
  const term = new Terminal({ ...TERM_OPTIONS, fontSize: configFontSize })
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

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
  ;(entry as any)._loadRenderer = loadRenderer

  registry.set(terminalId, entry)
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
    ;(entry as any)._loadRenderer?.()
    delete (entry as any)._loadRenderer
    setTimeout(() => entry!.fitAddon.fit(), 0)
    return entry
  }

  // Already exists — move the DOM element to the new container
  if (entry.currentContainer !== container) {
    const termEl = entry.term.element
    if (termEl) {
      container.innerHTML = ''
      container.appendChild(termEl)
    }
    entry.currentContainer = container
  }

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
export function fitTerminal(terminalId: string): void {
  const entry = registry.get(terminalId)
  if (!entry || !entry.currentContainer) return
  try {
    entry.fitAddon.fit()
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

/**
 * Fully destroy a terminal (when killing an agent).
 */
export function destroyTerminal(terminalId: string): void {
  const entry = registry.get(terminalId)
  if (!entry) return
  entry.removeDataListener()
  entry.term.dispose()
  registry.delete(terminalId)
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
