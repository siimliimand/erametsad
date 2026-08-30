/* eslint-disable no-console */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// The seed's crypto modules read ISIKUKOOD_ENCRYPTION_KEY and
// SEALED_BID_ENCRYPTION_KEY lazily, but load the environment first so a
// missing key fails before any table is wiped.
for (const dir of [process.cwd(), resolve(process.cwd(), '../..')]) {
  const envPath = resolve(dir, '.env')
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath)
    break
  }
}

async function main(): Promise<void> {
  const { resetAndSeed } = await import('../../lib/data/seed/run')
  await resetAndSeed()
}

main()
  .then(() => {
    console.log('Seed script finished')
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error('Seed script failed', error)
    process.exit(1)
  })
