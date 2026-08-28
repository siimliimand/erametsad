import type { CollectionConfig } from 'payload'

export const Page: CollectionConfig = {
  slug: 'pages',
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
      name: 'layout',
      type: 'blocks',
      blocks: [
        {
          slug: 'hero',
          fields: [
            {
              name: 'heading',
              type: 'text',
            },
            {
              name: 'subheading',
              type: 'text',
            },
            {
              name: 'backgroundImage',
              type: 'relationship',
              relationTo: 'media',
            },
            {
              name: 'ctaText',
              type: 'text',
            },
            {
              name: 'ctaLink',
              type: 'text',
            },
          ],
        },
        {
          slug: 'text',
          fields: [
            {
              name: 'content',
              type: 'richText',
            },
          ],
        },
        {
          slug: 'cards',
          fields: [
            {
              name: 'heading',
              type: 'text',
            },
            {
              name: 'cards',
              type: 'array',
              fields: [
                {
                  name: 'title',
                  type: 'text',
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
              ],
            },
          ],
        },
        {
          slug: 'accordion',
          fields: [
            {
              name: 'heading',
              type: 'text',
            },
            {
              name: 'items',
              type: 'array',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                },
                {
                  name: 'content',
                  type: 'richText',
                },
              ],
            },
          ],
        },
        {
          slug: 'steps',
          fields: [
            {
              name: 'heading',
              type: 'text',
            },
            {
              name: 'steps',
              type: 'array',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                },
                {
                  name: 'description',
                  type: 'textarea',
                },
              ],
            },
          ],
        },
        {
          slug: 'form',
          fields: [
            {
              name: 'formType',
              type: 'select',
              options: [
                { label: 'Lead', value: 'lead' },
                { label: 'Newsletter', value: 'newsletter' },
                { label: 'Contact', value: 'contact' },
              ],
            },
          ],
        },
        {
          slug: 'ticker',
          fields: [
            {
              name: 'source',
              type: 'select',
              options: [
                { label: 'Auctions', value: 'auctions' },
                { label: 'Statistics', value: 'statistics' },
              ],
            },
          ],
        },
        {
          slug: 'stats',
          fields: [
            {
              name: 'items',
              type: 'array',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                },
                {
                  name: 'value',
                  type: 'text',
                },
                {
                  name: 'suffix',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          slug: 'cta',
          fields: [
            {
              name: 'text',
              type: 'text',
            },
            {
              name: 'buttonText',
              type: 'text',
            },
            {
              name: 'buttonLink',
              type: 'text',
            },
            {
              name: 'backgroundImage',
              type: 'relationship',
              relationTo: 'media',
            },
          ],
        },
        {
          slug: 'testimonial',
          fields: [
            {
              name: 'testimonial',
              type: 'relationship',
              relationTo: 'testimonials',
            },
          ],
        },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'ogImage',
          type: 'relationship',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
  ],
}