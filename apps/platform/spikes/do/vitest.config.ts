import path from 'node:path'
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    root: __dirname,
    include: ['*.test.ts'],
    poolOptions: {
      workers: {
        main: path.join(__dirname, 'index.ts'),
        wrangler: { configPath: path.join(__dirname, 'wrangler.jsonc') },
        // The echo test leaves a WebSocket open at teardown, which breaks the
        // per-test storage snapshot restore. Tests use distinct object names,
        // so shared storage is safe here.
        isolatedStorage: false,
      },
    },
  },
})
