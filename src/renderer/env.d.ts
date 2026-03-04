/// <reference types="vite/client" />
import type { VibeGridAPI } from '../preload/index'

declare global {
  interface Window {
    api: VibeGridAPI
  }
}
