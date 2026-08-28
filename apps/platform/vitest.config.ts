import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // DO tests need the workers pool with their own config (task 3.8 wires
    // the runner); the node pool cannot resolve cloudflare:test.
    exclude: ['src/do/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})