import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  resolve: {
    alias: {
      // The renderer uses relative imports like '../../shared/types'
      // which resolve to src/shared/ barrel files that re-export @vibegrid/shared.
      // We alias them so Vite can resolve from the web package context.
      '@renderer': path.resolve(__dirname, '../../src/renderer'),
      '@shared': path.resolve(__dirname, '../../src/shared')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:3456',
        ws: true
      },
      '/health': {
        target: 'http://127.0.0.1:3456'
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
