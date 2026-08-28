import path from 'node:path'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: path.resolve(__dirname, 'schema.ts'),
  out: path.resolve(__dirname, 'migrations'),
})
