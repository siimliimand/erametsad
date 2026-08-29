import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The app's own vitest run uses cwd as root; pin this suite's root to the
  // config dir so the include stays local regardless of invocation cwd.
  test: {
    root: __dirname,
    include: ['*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
})
