import path from 'node:path'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: path.resolve(__dirname, 'src/lib/data/schema/index.ts'),
  out: path.resolve(__dirname, 'drizzle'),
})
