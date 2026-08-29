import path from 'node:path'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: path.resolve(__dirname, 'src/lib/data/schema/index.ts'),
  // drizzle-kit reads prior snapshots as `./<path>`; an absolute out breaks
  // that resolution, so keep it relative to the package cwd.
  out: './drizzle',
})
