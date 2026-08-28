import type { CollectionConfig } from 'payload'

export const FAQItem: CollectionConfig = {
  slug: 'faq-items',
  admin: {
    useAsTitle: 'question',
    group: 'CMS',
  },
  fields: [
    {
      name: 'question',
      type: 'text',
      required: true,
    },
    {
      name: 'answer',
      type: 'richText',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'faq-categories',
      required: true,
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'slug',
      type: 'text',
    },
  ],
}