/* eslint-disable no-console */
import type { CoreRepositories } from '../repositories'
import { seedAuctions } from './auctions'
import { seedBids } from './bids'
import { seedCms } from './cms'
import { seedContractTemplates } from './contracts'
import { seedLeads } from './leads'
import { seedSpecialists } from './specialists'
import { seedTaxonomies } from './taxonomies'
import { seedUsers } from './users'

async function seedSettings(repos: CoreRepositories): Promise<void> {
  const existing = await repos.find({ collection: 'settings', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Settings already seeded, skipping')
    return
  }

  await repos.create({
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

export async function seed(repos: CoreRepositories): Promise<void> {
  console.log('Seeding database…')

  await seedSettings(repos)
  await seedUsers(repos)
  await seedSpecialists(repos)
  await seedTaxonomies(repos)
  await seedAuctions(repos)
  await seedBids(repos)
  await seedCms(repos)
  await seedContractTemplates(repos)
  await seedLeads(repos)

  console.log('Seeding complete')
}
