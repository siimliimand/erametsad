import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // DO and queue-consumer tests need the workers pool; the package.json
    // test chain runs each through its own vitest.config.ts. The node pool
    // cannot resolve cloudflare:test, so they stay excluded here.
    exclude: ['src/do/**', 'src/workers/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})