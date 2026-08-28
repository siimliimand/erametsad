import type { Payload } from 'payload'

import { seedAuctions } from './auctions'
import { seedBids } from './bids'
import { seedCms } from './cms'
import { seedContractTemplates } from './contracts'
import { seedLeads } from './leads'
import { seedSpecialists } from './specialists'
import { seedTaxonomies } from './taxonomies'
import { seedUsers } from './users'

export async function seed(payload: Payload): Promise<void> {
  console.log('Seeding database…')

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