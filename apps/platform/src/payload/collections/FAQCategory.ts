import type { CollectionConfig } from 'payload'

export const FAQCategory: CollectionConfig = {
  slug: 'faq-categories',
  admin: {
    useAsTitle: 'title',
    group: 'CMS',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
    },
  ],
}