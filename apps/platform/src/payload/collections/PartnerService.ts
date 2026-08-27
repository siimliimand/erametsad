import type { CollectionConfig } from 'payload'

export const PartnerService: CollectionConfig = {
  slug: 'partner-services',
  admin: {
    useAsTitle: 'name',
    group: 'CMS',
  },
  fields: [
    {
      name: 'name',
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
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'icon',
      type: 'text',
    },
    {
      name: 'link',
      type: 'text',
    },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}