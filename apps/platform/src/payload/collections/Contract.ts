import type { CollectionConfig } from 'payload'

export const Contract: CollectionConfig = {
  slug: 'contracts',
  admin: {
    useAsTitle: 'id',
    group: 'Auction',
    defaultColumns: ['lot', 'template', 'status', 'signedAt'],
  },
  fields: [
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'contract-templates',
      required: true,
    },
    {
      name: 'lot',
      type: 'relationship',
      relationTo: 'auctions',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'prepared',
      options: [
        { label: 'Prepared', value: 'prepared' },
        { label: 'Sent', value: 'sent' },
        { label: 'Signed', value: 'signed' },
        { label: 'Voided', value: 'voided' },
      ],
    },
    {
      name: 'signedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'signedBy',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'contentHash',
      type: 'text',
      admin: {
        description: 'Hash of signed content for audit',
      },
    },
    {
      name: 'renderedHtml',
      type: 'textarea',
      admin: {
        description: 'HTML preview of the filled template',
      },
    },
  ],
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      return role === 'admin' || role === 'superadmin'
    },
    read: ({ req: { user } }) => {
      if (!user) return false
      return true
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      return role === 'admin' || role === 'superadmin'
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      return role === 'admin' || role === 'superadmin'
    },
  },
}