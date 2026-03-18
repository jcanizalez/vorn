import { registerSW } from 'virtual:pwa-register'
import { createApiShim } from './api-shim'
import { getWebSocketUrl } from './env'

// Register service worker for PWA installability and asset caching.
// This runs independently of the WebSocket connection.
registerSW({ immediate: true })

// Mount the API shim on window.api BEFORE any React code loads.
// This is critical: stores and components access window.api at import time.
const api = createApiShim(getWebSocketUrl())
;(window as unknown as { api: typeof api }).api = api

// Wait for WebSocket connection before rendering
api.__ready().then(async () => {
  // Dynamic import so React + App only load after shim is ready
  const { createRoot } = await import('react-dom/client')
  const { App } = await import('@renderer/App')

  // Import the global CSS (Tailwind + custom styles)
  await import('./global.css')

  const root = createRoot(document.getElementById('root')!)
  root.render(<App />)
})
