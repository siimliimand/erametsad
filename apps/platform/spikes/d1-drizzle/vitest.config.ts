import path from 'node:path'
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const d1Migrations = await readD1Migrations(path.join(__dirname, 'migrations'))

  return {
    test: {
      root: __dirname,
      include: ['*.test.ts'],
      setupFiles: ['./apply-migrations.ts'],
      poolOptions: {
        workers: {
          miniflare: {
            compatibilityDate: '2025-04-01',
            d1Databases: { DB: 'spike-d1-drizzle' },
            bindings: { D1_MIGRATIONS: d1Migrations },
          },
        },
      },
    },
  }
})
