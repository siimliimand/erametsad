import type { CollectionConfig } from 'payload'

export const AuctionRight: CollectionConfig = {
  slug: 'auction-rights',
  admin: {
    useAsTitle: 'id',
    group: 'Identity & Access',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'objectType',
      type: 'select',
      required: true,
      options: [
        { label: 'Raieõigus', value: 'raieoigus' },
        { label: 'Kinnistu', value: 'kinnistu' },
        { label: 'Kiire', value: 'kiire' },
        { label: 'Pakett', value: 'pakett' },
      ],
    },
    {
      name: 'grantedBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'grantedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'revokedAt',
      type: 'date',
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'superadmin') return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => {
      return user?.role === 'admin' || user?.role === 'superadmin'
    },
    update: ({ req: { user } }) => {
      return user?.role === 'admin' || user?.role === 'superadmin'
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin' || user?.role === 'superadmin'
    },
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc: _originalDoc, operation }) => {
        if (operation === 'create') {
          return data
        }
        return data
      },
    ],
  },
}