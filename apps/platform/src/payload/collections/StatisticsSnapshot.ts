import type { CollectionConfig } from 'payload'

export const StatisticsSnapshot: CollectionConfig = {
  slug: 'statistics-snapshots',
  admin: {
    useAsTitle: 'date',
    group: 'Auction',
    defaultColumns: ['date', 'objectType', 'count', 'eur'],
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'objectType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Raieoigus', value: 'raieoigus' },
        { label: 'Kinnistu', value: 'kinnistu' },
        { label: 'Kiire', value: 'kiire' },
        { label: 'Pakett', value: 'pakett' },
      ],
    },
    {
      name: 'count',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'area',
      type: 'number',
      min: 0,
    },
    {
      name: 'volume',
      type: 'number',
      min: 0,
    },
    {
      name: 'eur',
      type: 'number',
      required: true,
      min: 0,
    },
  ],
  indexes: [
    {
      fields: ['date', 'objectType'],
      unique: true,
    },
  ],
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      return role === 'admin' || role === 'superadmin'
    },
    read: () => true,
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