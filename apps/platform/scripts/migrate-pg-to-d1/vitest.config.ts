import { defineConfig } from 'vitest/config'

// Separate config so `pnpm test:migrate-tool` runs the migration tooling
// suite without pulling the app's src-only include list (vitest.config.ts)
// or the workers-pool configs into scope.
export default defineConfig({
  test: {
    include: ['scripts/migrate-pg-to-d1/*.test.ts'],
  },
})
