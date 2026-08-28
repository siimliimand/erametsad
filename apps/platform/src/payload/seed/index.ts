import type { Payload } from 'payload'

import { seedAuctions } from './auctions'
import { seedBids } from './bids'
import { seedCms } from './cms'
import { seedContractTemplates } from './contracts'
import { seedLeads } from './leads'
import { seedSpecialists } from './specialists'
import { seedTaxonomies } from './taxonomies'
import { seedUsers } from './users'

async function seedSettings(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'settings', limit: 1 })
  if (existing.totalDocs > 0) {
    console.log('Settings already seeded, skipping')
    return
  }

  await payload.create({
    collection: 'settings',
    data: {
      orgName: 'Erametsad OÜ',
      feePercent: 3,
      vatPercent: 22,
      antiSnipeDurationMinutes: 5,
      alapakkumineEnabled: true,
      sealedRevisionCap: 3,
      featureFlags: { requireFrameworkContract: true },
    },
  })

  console.log('Seeded settings (featureFlags.requireFrameworkContract: true)')
}

export async function seed(payload: Payload): Promise<void> {
  console.log('Seeding database…')

  await seedSettings(payload)
  await seedUsers(payload)
  await seedSpecialists(payload)
  await seedTaxonomies(payload)
  await seedAuctions(payload)
  await seedBids(payload)
  await seedCms(payload)
  await seedContractTemplates(payload)
  await seedLeads(payload)

  console.log('Seeding complete')
}