import type { Payload } from 'payload'

export async function seedContractTemplates(payload: Payload): Promise<void> {
  const existing = await payload.find({ collection: 'contract-templates', limit: 1 })
  if (existing.totalDocs > 0) {
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

  await payload.create({
    collection: 'contract-templates',
    data: {
      name: 'Raamlepingu mall',
      type: 'framework',
      version: '1.0',
      placeholders,
      active: true,
    },
  })

  await payload.create({
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