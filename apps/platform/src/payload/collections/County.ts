import type { CollectionConfig } from 'payload'

export const County: CollectionConfig = {
  slug: 'counties',
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
      required: true,
      unique: true,
      maxLength: 2,
      minLength: 2,
    },
  ],
}