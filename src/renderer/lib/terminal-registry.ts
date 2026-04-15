import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalEntry {
  term: Terminal
  fitAddon: FitAddon
  currentContainer: HTMLDivElement | null
  _loadRenderer?: (() => void) | null
  _gpuAddon?: { dispose(): void } | null
}

export interface TerminalViewportState {
  line: number
  atBottom: boolean
}

const registry = new Map<string, TerminalEntry>()
const readyCallbacks = new Map<string, Set<() => void>>()

// --- Write batching: single global listener + requestAnimationFrame ---
const pendingWrites = new Map<string, string[]>()
let rafId: number | null = null

function scheduleFlush(): void {
  if (rafId !== null) return
  rafId = requestAnimationFrame(flushWrites)
}

function flushWrites(): void {
  rafId = null
  for (const [id, chunks] of pendingWrites) {
    const data = chunks.length === 1 ? chunks[0] : chunks.join('')
    const entry = registry.get(id)
    if (entry) entry.term.write(data)
    statusHandlers.get(id)?.(data)
  }
  pendingWrites.clear()
}

let removeGlobalDataListener: (() => void) | null = null

export function initGlobalDataListener(): void {
  if (removeGlobalDataListener) return
  removeGlobalDataListener = window.api.onTerminalData(({ id, data }) => {
    const existing = pendingWrites.get(id)
    if (existing) {
      existing.push(data)
    } else {
      pendingWrites.set(id, [data])
    }
    scheduleFlush()
  })
}

export function disposeGlobalDataListener(): void {
  removeGlobalDataListener?.()
  removeGlobalDataListener = null
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  pendingWrites.clear()
}

// --- Status detection handler registry ---
type StatusHandler = (data: string) => void
const statusHandlers = new Map<string, StatusHandler>()

export function registerStatusHandler(terminalId: string, handler: StatusHandler): () => void {
  statusHandlers.set(terminalId, handler)
  return () => {
    statusHandlers.delete(terminalId)
  }
}

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
  scrollback: 5000,
  allowProposedApi: true
}

/** Allow overriding default font size from config */
let configFontSize = 13

export function setDefaultFontSize(size: number): void {
  configFontSize = size
}

/** Returns the effective font size (respects user config, no forced minimum). */
export function getEffectiveFontSize(size?: number): number {
  return size ?? configFontSize
}

const rendererIsMac = navigator.platform.toUpperCase().includes('MAC')

function createTerminalEntry(terminalId: string): TerminalEntry {
  const term = new Terminal({ ...TERM_OPTIONS, fontSize: getEffectiveFontSize() })
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  // Clickable links — Cmd+click (Mac) / Ctrl+click (Windows/Linux) opens in browser
  term.loadAddon(
    new WebLinksAddon((event, uri) => {
      const mod = rendererIsMac ? event.metaKey : event.ctrlKey
      if (mod) window.api.openExternal(uri)
    })
  )

  // Let app-level shortcuts pass through instead of being consumed by xterm
  term.attachCustomKeyEventHandler((e) => {
    const mod = rendererIsMac ? e.metaKey : e.ctrlKey
    if (!mod) return true

    if (!rendererIsMac && e.type === 'keydown') {
      const key = e.key.toLowerCase()

      // Copy on Windows/Linux — Ctrl+C copies when text is selected,
      // otherwise falls through so xterm sends SIGINT. Ctrl+Shift+C always copies.
      if (key === 'c' && (e.shiftKey || term.hasSelection())) {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection())
          term.clearSelection()
        }
        e.preventDefault()
        return false
      }

      // Paste on Windows/Linux — Ctrl+V / Ctrl+Shift+V: xterm intercepts Ctrl+V
      // as a control character (\x16) instead of triggering the browser paste event.
      // Read clipboard manually and use term.paste() for bracketed-paste support.
      // preventDefault() is critical to stop the browser from also firing a native
      // paste event, which would cause xterm to paste the text a second time.
      if (key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then((text) => {
          if (text) term.paste(text)
        })
        return false
      }
    }

    const passthrough = ['w', '[', ']', 'k', 'n', 'o', 'b', ',', '/']
    if (passthrough.includes(e.key.toLowerCase())) return false
    return true
  })

  // Try WebGL, fall back to canvas. Idempotent + detach-safe: bails if the
  // terminal is destroyed, already has a live renderer, or has been detached
  // while the dynamic import was in flight.
  const loadRenderer = (): void => {
    const current = registry.get(terminalId)
    if (!current || current._gpuAddon) return
    import('@xterm/addon-webgl')
      .then(({ WebglAddon }) => {
        const e = registry.get(terminalId)
        if (!e || !e.currentContainer || e._gpuAddon) return
        try {
          const addon = new WebglAddon()
          term.loadAddon(addon)
          e._gpuAddon = addon
          term.refresh(0, term.rows - 1)
        } catch {
          import('@xterm/addon-canvas').then(({ CanvasAddon }) => {
            const e2 = registry.get(terminalId)
            if (!e2 || !e2.currentContainer || e2._gpuAddon) return
            const addon = new CanvasAddon()
            term.loadAddon(addon)
            e2._gpuAddon = addon
            term.refresh(0, term.rows - 1)
          })
        }
      })
      .catch(() => {
        import('@xterm/addon-canvas').then(({ CanvasAddon }) => {
          const e = registry.get(terminalId)
          if (!e || !e.currentContainer || e._gpuAddon) return
          const addon = new CanvasAddon()
          term.loadAddon(addon)
          e._gpuAddon = addon
          term.refresh(0, term.rows - 1)
        })
      })
  }

  // Forward keystrokes to pty
  term.onData((data) => {
    window.api.writeTerminal(terminalId, data)
  })

  const entry: TerminalEntry = {
    term,
    fitAddon,
    currentContainer: null
  }

  // Retained across pause/resume cycles — called whenever a detached
  // terminal is re-attached so we can rebuild the GPU renderer.
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

  // Resume the renderer if it was paused while detached.
  if (!entry._gpuAddon) {
    entry._loadRenderer?.()
  }

  return entry
}

/**
 * Detach a terminal from its current container (e.g. on component unmount).
 * Does NOT dispose the Terminal — it stays alive in the registry and its
 * buffer keeps receiving pty data. Releases the GPU renderer addon though,
 * since there's no visible canvas for it to draw to. The renderer is
 * rebuilt by attachTerminal on re-attach.
 */
export function detachTerminal(terminalId: string, container: HTMLDivElement): void {
  const entry = registry.get(terminalId)
  if (!entry || entry.currentContainer !== container) return
  entry.currentContainer = null
  if (entry._gpuAddon) {
    try {
      entry._gpuAddon.dispose()
    } catch {
      // GL context may already be lost
    }
    entry._gpuAddon = null
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

export function getTerminalSelection(terminalId: string): string {
  const entry = registry.get(terminalId)
  if (!entry || !entry.term.hasSelection()) return ''
  return entry.term.getSelection()
}

export function clearTerminalSelection(terminalId: string): void {
  registry.get(terminalId)?.term.clearSelection()
}

export function pasteToTerminal(terminalId: string, text: string): void {
  registry.get(terminalId)?.term.paste(text)
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
  // Flush any pending batched writes before destroying
  const chunks = pendingWrites.get(terminalId)
  if (chunks) {
    entry.term.write(chunks.join(''))
    pendingWrites.delete(terminalId)
  }
  statusHandlers.delete(terminalId)
  // Dispose GPU addon first to avoid WebGL errors when the terminal
  // tears down the DOM element before the addon can clean up its GL context
  if (entry._gpuAddon) {
    try {
      entry._gpuAddon.dispose()
    } catch {
      // GL context may already be lost
    }
    entry._gpuAddon = null
  }
  entry.term.dispose()
  registry.delete(terminalId)
  readyCallbacks.delete(terminalId)
}

/**
 * Update font size on all terminals and re-fit them.
 * Callers are responsible for clamping to MIN/MAX bounds.
 */
export function setAllTerminalsFontSize(fontSize: number): void {
  const effective = getEffectiveFontSize(fontSize)
  for (const [id, entry] of registry) {
    entry.term.options.fontSize = effective
    fitTerminal(id)
  }
}

/**
 * Get the current font size of the first mounted terminal (for UI display).
 */
export function getCurrentTerminalFontSize(): number {
  for (const entry of registry.values()) {
    return entry.term.options.fontSize ?? getEffectiveFontSize()
  }
  return getEffectiveFontSize()
}

/**
 * Re-fit all terminals that have a current container (i.e. are mounted).
 * Used when the virtual keyboard changes viewport geometry.
 */
export function fitAllTerminals(): void {
  for (const [id, entry] of registry) {
    if (entry.currentContainer) fitTerminal(id)
  }
}
