/* eslint-disable no-console */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

// payload's config import runs @next/env's loadEnvConfig, which crashes
// under tsx unless the environment is already loaded. Process .env from the
// package dir or the monorepo root before importing anything from payload.
for (const dir of [process.cwd(), resolve(process.cwd(), '../..')]) {
  const envPath = resolve(dir, '.env')
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
    break
  }
}

// tsx compiles this entry to CJS, and its esbuild interop keeps an ESM
// default import of @next/env undefined because that package ships
// __esModule with no default. payload's loadEnv.js then crashes on
// destructuring. @next/env is a transitive dep (via payload/next), so
// resolve it from payload and attach a default before payload loads.
const localRequire = createRequire(resolve(process.cwd(), 'index.js'))
const payloadEntry = localRequire.resolve('payload')
const payloadRoot = dirname(dirname(payloadEntry))
const nextEnvPath = localRequire.resolve('@next/env', { paths: [payloadRoot] })
const nextEnv = localRequire(nextEnvPath) as { default?: unknown }
if (nextEnv.default === undefined) {
  nextEnv.default = nextEnv
}

const COLLECTIONS_IN_ORDER = [
  // Level 1 — no dependents (leaf collections)
  'bids',
  'autobidders',
  'auction-subscriptions',
  'notifications',
  // Level 2
  'contracts',
  'contract-templates',
  // Level 3
  'statistics-snapshots',
  'audit-entry',
  // Level 4
  'leads',
  // Level 5
  'auctions',
  // Level 6
  'auction-rights',
  // Level 7 — depend on users
  'profile',
  'company-access-request',
  // Level 8 — CMS
  'settings',
  'faq-items',
  'testimonials',
  'partner-services',
  'legal-documents',
  'redirects',
  'pages',
  'articles',
  'faq-categories',
  // Level 9
  'specialist',
  // Level 10
  'users',
  // Level 11 — taxonomy (no FK to users)
  'parishes',
  'counties',
]

export async function resetAndSeed(): Promise<void> {
  // Imported lazily so the .env loop above runs before payload's config
  // module (and @next/env with it) is loaded.
  const { getPayload } = await import('payload')
  const { seed } = await import('./index')
  const config = (await import('../../payload.config')).default

  console.log('Resetting database…')

  const payload = await getPayload({ config })

  for (const slug of COLLECTIONS_IN_ORDER) {
    let deleted = 0
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const result = await payload.find({
        collection: slug,
        limit: 100,
        depth: 0,
        pagination: false,
      })
      if (result.docs.length === 0) break
      for (const doc of result.docs) {
        await payload.delete({
          collection: slug,
          id: doc.id,
        })
        deleted++
      }
    }
    if (deleted > 0) {
      console.log(`  Truncated ${String(deleted)} records from "${slug}"`)
    }
  }

  console.log('Database reset complete. Running seed…')
  await seed(payload)
}

resetAndSeed()
  .then(() => {
    console.log('Seed script finished')
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error('Seed script failed', error)
    process.exit(1)
  })