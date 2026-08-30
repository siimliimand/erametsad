import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'

export default defineWorkersConfig({
  test: {
    root: __dirname,
    include: ['*.test.ts'],
    poolOptions: {
      workers: {
        main: path.join(__dirname, '../../rate-limiter.ts'),
        wrangler: { configPath: path.join(__dirname, 'wrangler.jsonc') },
        // Same rationale as the auction DO suite: the live DO instance makes
        // per-test storage snapshots fail at teardown; tests use unique keys.
        isolatedStorage: false,
        miniflare: {
          compatibilityDate: '2025-04-01',
        },
      },
    },
  },
})
