/* eslint-disable no-console */
import type { CoreRepositories } from '../repositories'

export async function seedContractTemplates(repos: CoreRepositories): Promise<void> {
  const existing = await repos.find({ collection: 'contract-templates', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Contract templates already seeded, skipping')
    return
  }

  const placeholders = [
    { key: '{{buyerName}}' },
    { key: '{{buyerRegCode}}' },
    { key: '{{sellerName}}' },
    { key: '{{propertyDescription}}' },
    { key: '{{price}}' },
    { key: '{{date}}' },
  ]

  await repos.create({
    collection: 'contract-templates',
    data: {
      name: 'Raamlepingu mall',
      type: 'framework',
      version: '1.0',
      placeholders,
      active: true,
    },
  })

  await repos.create({
    collection: 'contract-templates',
    data: {
      name: 'Oksjoni müügilepingu mall',
      type: 'auction',
      version: '1.0',
      placeholders,
      active: true,
    },
  })

  console.log('Seeded 2 contract templates')
}
