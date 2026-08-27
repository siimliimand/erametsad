import type { Payload } from 'payload'

import { seedAuctions } from './auctions'
import { seedSpecialists } from './specialists'
import { seedTaxonomies } from './taxonomies'
import { seedUsers } from './users'

export async function seed(payload: Payload): Promise<void> {
  console.log('Seeding database…')

  await seedUsers(payload)
  await seedSpecialists(payload)
  await seedTaxonomies(payload)
  await seedAuctions(payload)

  console.log('Seeding complete')
}