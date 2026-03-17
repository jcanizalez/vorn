import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: [
        'packages/server/src/**/*.ts',
        'packages/shared/src/**/*.ts',
        'src/renderer/lib/**/*.ts'
      ],
      exclude: [
        'packages/server/src/index.ts',
        'packages/server/src/register-methods.ts',
        'packages/server/src/pty-manager.ts',
        'packages/server/src/logger.ts',
        'packages/server/src/hook-server.ts',
        'packages/server/src/hook-installer.ts',
        'packages/server/src/copilot-hook-installer.ts',
        'packages/server/src/task-images.ts',
        'src/renderer/lib/terminal-registry.ts',
        'src/renderer/lib/workflow-execution.ts',
        'src/renderer/lib/workflow-triggers.ts',
        'src/renderer/lib/terminal-close.ts',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer')
    }
  }
})
