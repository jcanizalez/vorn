import { Terminal, type ITerminalAddon } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface TerminalEntry {
  term: Terminal
  fitAddon: FitAddon
  currentContainer: HTMLDivElement | null
  persistentWrapper: HTMLDivElement | null
  activeSlot: HTMLElement | null
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
  scrollback: 2000,
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

  const mountAddon = (make: () => ITerminalAddon): void => {
    // Re-check under the await — the terminal may have been destroyed or
    // detached while the dynamic import was in flight, and a concurrent
    // load may have already installed an addon.
    const e = registry.get(terminalId)
    if (!e || !e.currentContainer || e._gpuAddon) return
    const addon = make()
    term.loadAddon(addon)
    e._gpuAddon = addon
    term.refresh(0, term.rows - 1)
  }
  // Terminal fallback — if even canvas fails to load, there's no further
  // fallback, so swallow the error here instead of propagating an unhandled
  // rejection up through the WebGL error paths.
  const loadCanvas = (): void => {
    import('@xterm/addon-canvas')
      .then(({ CanvasAddon }) => mountAddon(() => new CanvasAddon()))
      .catch(() => {})
  }
  const loadRenderer = (): void => {
    const current = registry.get(terminalId)
    if (!current || current._gpuAddon) return
    import('@xterm/addon-webgl')
      .then(({ WebglAddon }) => {
        try {
          mountAddon(() => new WebglAddon())
        } catch {
          loadCanvas()
        }
      })
      .catch(() => {
        loadCanvas()
      })
  }

  // Forward keystrokes to pty
  term.onData((data) => {
    window.api.writeTerminal(terminalId, data)
  })

  const entry: TerminalEntry = {
    term,
    fitAddon,
    currentContainer: null,
    persistentWrapper: null,
    activeSlot: null
  }

  entry._loadRenderer = loadRenderer

  registry.set(terminalId, entry)

  const cbs = readyCallbacks.get(terminalId)
  if (cbs) {
    cbs.forEach((cb) => cb())
    readyCallbacks.delete(terminalId)
  }

  notifyRegistryChange()

  return entry
}

// ────────────────────────────────────────────────────────────────────
// Persistent-host / slot API (PR A — no consumer wired up yet).
//
// The old model reparents the xterm DOM into whichever container is mounted
// (TerminalInstance, ShellTerminal, etc). Reparenting interrupts the WebGL
// context and produces flicker on focused ↔ grid switching.
//
// The new model: every xterm is opened into a "persistent wrapper" div that
// lives in a singleton TerminalHost at the app root and never moves. Each
// consumer renders a thin "slot" div; the host positions the wrapper to
// overlay the active slot via fixed-position CSS. DOM never moves → no
// flicker. The TerminalHost component (PR B) owns ResizeObserver and calls
// syncTerminalOverlay on each observed rect change.
// ────────────────────────────────────────────────────────────────────

let hostRoot: HTMLElement | null = null
const registryChangeListeners = new Set<() => void>()

function notifyRegistryChange(): void {
  for (const cb of registryChangeListeners) {
    try {
      cb()
    } catch {
      // listener threw — isolate to not block other subscribers
    }
  }
}

function ensurePersistentWrapper(entry: TerminalEntry, terminalId: string): HTMLDivElement {
  if (entry.persistentWrapper) return entry.persistentWrapper
  const wrapper = document.createElement('div')
  wrapper.dataset.terminalId = terminalId
  wrapper.style.position = 'fixed'
  wrapper.style.top = '0'
  wrapper.style.left = '0'
  wrapper.style.width = '0'
  wrapper.style.height = '0'
  wrapper.style.visibility = 'hidden'
  wrapper.style.pointerEvents = 'none'
  entry.persistentWrapper = wrapper
  if (hostRoot) {
    hostRoot.appendChild(wrapper)
    openIntoPersistentWrapper(entry)
  }
  return wrapper
}

function openIntoPersistentWrapper(entry: TerminalEntry): void {
  if (entry.term.element) return
  const wrapper = entry.persistentWrapper
  if (!wrapper || !wrapper.parentElement) return
  entry.term.open(wrapper)
  entry._loadRenderer?.()
}

/**
 * Attach the singleton TerminalHost's root element. Wrappers are appended
 * here; passing null detaches (wrappers remain in the DOM until destroy).
 */
export function setHostRoot(root: HTMLElement | null): void {
  hostRoot = root
  if (!root) return
  for (const entry of registry.values()) {
    const wrapper = entry.persistentWrapper
    if (wrapper && wrapper.parentElement !== root) {
      root.appendChild(wrapper)
      openIntoPersistentWrapper(entry)
    }
  }
}

/**
 * Register a slot element for a terminal. The wrapper is created (lazily)
 * and will track this slot's bounding rect via syncTerminalOverlay.
 * Last-registered slot wins if multiple slots register for the same id.
 */
export function registerSlot(terminalId: string, slotEl: HTMLElement): void {
  let entry = registry.get(terminalId)
  if (!entry) entry = createTerminalEntry(terminalId)
  entry.activeSlot = slotEl
  ensurePersistentWrapper(entry, terminalId)
  openIntoPersistentWrapper(entry)
  syncTerminalOverlay(terminalId)
}

/**
 * Unregister a slot. No-op if the current active slot is not this element
 * (protects against out-of-order unmounts during rapid view swaps).
 */
export function unregisterSlot(terminalId: string, slotEl: HTMLElement): void {
  const entry = registry.get(terminalId)
  if (!entry || entry.activeSlot !== slotEl) return
  entry.activeSlot = null
  syncTerminalOverlay(terminalId)
}

export function getPersistentWrapper(terminalId: string): HTMLDivElement | null {
  return registry.get(terminalId)?.persistentWrapper ?? null
}

/**
 * Position the persistent wrapper to overlay the active slot. If no slot
 * is active or the slot has zero dimensions, the wrapper is hidden via
 * visibility (not display:none — xterm needs nonzero layout metrics).
 */
export function syncTerminalOverlay(terminalId: string): void {
  const entry = registry.get(terminalId)
  const wrapper = entry?.persistentWrapper
  if (!entry || !wrapper) return
  const slot = entry.activeSlot
  if (!slot) {
    wrapper.style.visibility = 'hidden'
    wrapper.style.pointerEvents = 'none'
    return
  }
  const rect = slot.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    wrapper.style.visibility = 'hidden'
    wrapper.style.pointerEvents = 'none'
    return
  }
  wrapper.style.top = `${rect.top}px`
  wrapper.style.left = `${rect.left}px`
  wrapper.style.width = `${rect.width}px`
  wrapper.style.height = `${rect.height}px`
  wrapper.style.visibility = 'visible'
  wrapper.style.pointerEvents = 'auto'
  if (entry.term.element) {
    try {
      entry.fitAddon.fit()
      const { cols, rows } = entry.term
      window.api.resizeTerminal({ id: terminalId, cols, rows })
    } catch {
      // fit can throw if wrapper has 0 dimensions
    }
  }
}

export function onRegistryChange(cb: () => void): () => void {
  registryChangeListeners.add(cb)
  return () => {
    registryChangeListeners.delete(cb)
  }
}

export function getRegisteredTerminalIds(): string[] {
  return Array.from(registry.keys())
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
  if (!entry._gpuAddon) {
    entry._loadRenderer?.()
  }

  // Fit synchronously so the terminal renders at the correct size on the very
  // first paint in the new container. Without this, the caller's rAF-scheduled
  // fit produces a visible frame at the old size before the resized frame lands,
  // which shows up as a flicker when switching focused ↔ grid.
  fitTerminal(terminalId)

  return entry
}

/**
 * Detach a terminal from its current container (e.g. on component unmount).
 * Does NOT dispose the Terminal — it stays alive in the registry and its
 * buffer keeps receiving pty data. Releases the active renderer addon
 * (WebGL or canvas fallback) since there's no visible surface for it to
 * draw to. The renderer is rebuilt by attachTerminal on re-attach.
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
  if (entry.persistentWrapper) {
    entry.persistentWrapper.remove()
    entry.persistentWrapper = null
  }
  entry.activeSlot = null
  registry.delete(terminalId)
  readyCallbacks.delete(terminalId)
  notifyRegistryChange()
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
