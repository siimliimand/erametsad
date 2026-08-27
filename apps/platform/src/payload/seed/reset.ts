import { getPayload } from 'payload'

import config from '../../payload.config'
import { seed } from './index'

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
  console.log('Resetting database…')

  const payload = await getPayload({ config })

  for (const slug of COLLECTIONS_IN_ORDER) {
    let deleted = 0
    // eslint-disable-next-line no-constant-condition
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
      console.log(`  Truncated ${deleted} records from "${slug}"`)
    }
  }

  console.log('Database reset complete. Running seed…')
  await seed(payload)
}