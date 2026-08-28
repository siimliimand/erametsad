import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'

export default defineWorkersConfig(async () => {
  const d1Migrations = await readD1Migrations(path.join(__dirname, '../../../drizzle'))

  return {
    test: {
      root: __dirname,
      include: ['*.test.ts'],
      setupFiles: ['./apply-migrations.ts'],
      poolOptions: {
        workers: {
          main: path.join(__dirname, '../queue-consumer.ts'),
          wrangler: { configPath: path.join(__dirname, 'wrangler.jsonc') },
          // Same reason as src/do/__tests__: the per-test storage snapshot
          // restore fails at teardown against live D1. Safe because every
          // test uses unique ids, keys, and emails.
          isolatedStorage: false,
          miniflare: {
            compatibilityDate: '2025-04-01',
            bindings: { D1_MIGRATIONS: d1Migrations },
          },
        },
      },
    },
  }
})
