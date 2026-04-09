/// <reference types="vite/client" />
import type { VornAPI } from '../preload/index'

declare global {
  interface Window {
    api: VornAPI
  }
}
