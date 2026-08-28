import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // DO and queue-consumer tests need the workers pool with their own
    // configs (tasks 3.8 and 6.3 wire the runners); the node pool cannot
    // resolve cloudflare:test.
    exclude: ['src/do/**', 'src/workers/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})