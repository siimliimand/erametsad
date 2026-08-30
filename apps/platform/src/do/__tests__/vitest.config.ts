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
          main: path.join(__dirname, '../auction.ts'),
          wrangler: { configPath: path.join(__dirname, 'wrangler.jsonc') },
          // Like spikes/do: the per-test storage snapshot restore fails at
          // teardown (D1 + live DO instance). Safe here because every test
          // uses unique auction ids, slugs, and emails.
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
