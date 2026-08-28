import type { CollectionConfig } from 'payload'

export const Parish: CollectionConfig = {
  slug: 'parishes',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'code',
      type: 'text',
    },
    {
      name: 'county',
      type: 'relationship',
      relationTo: 'counties',
      required: true,
    },
  ],
}