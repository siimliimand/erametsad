import type { CollectionConfig } from 'payload'

export const LegalDocument: CollectionConfig = {
  slug: 'legal-documents',
  admin: {
    useAsTitle: 'title',
    group: 'CMS',
  },
  versions: { drafts: true },
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
      name: 'type',
      type: 'select',
      options: [
        { label: 'Terms of Service', value: 'terms' },
        { label: 'Privacy Policy', value: 'privacy' },
        { label: 'Cookies', value: 'cookies' },
        { label: 'Contract', value: 'contract' },
      ],
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'version',
      type: 'text',
    },
    {
      name: 'effectiveDate',
      type: 'date',
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
}