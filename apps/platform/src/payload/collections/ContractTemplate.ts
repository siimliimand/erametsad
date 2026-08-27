import type { CollectionConfig } from 'payload'

export const ContractTemplate: CollectionConfig = {
  slug: 'contract-templates',
  admin: {
    useAsTitle: 'name',
    group: 'Auction',
    defaultColumns: ['name', 'type', 'version', 'active'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Framework', value: 'framework' },
        { label: 'Auction', value: 'auction' },
      ],
    },
    {
      name: 'version',
      type: 'text',
      required: true,
    },
    {
      name: 'placeholders',
      type: 'array',
      fields: [
        {
          name: 'key',
          type: 'text',
        },
      ],
      admin: {
        description: '{{key}} strings used in the template',
      },
    },
    {
      name: 'docxFile',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'The uploaded DOCX template',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const newActive = (data as Record<string, unknown>).active as boolean | undefined
        const oldActive = (originalDoc as Record<string, unknown> | undefined)
          ?.active as boolean | undefined

        if (!newActive || newActive === oldActive) return data

        const type = (data as Record<string, unknown>).type as string | undefined
        if (!type) return data

        const payload = req.payload
        const currentId = (originalDoc as Record<string, unknown> | undefined)
          ?.id as string | undefined

        const result = await payload.find({
          collection: 'contract-templates',
          where: {
            and: [
              { type: { equals: type } },
              { active: { equals: true } },
              ...(currentId ? [{ id: { not_equals: currentId } }] : []),
            ],
          },
          limit: 100,
        })

        for (const doc of result.docs) {
          await payload.update({
            collection: 'contract-templates',
            id: doc.id,
            data: { active: false },
          })
        }

        return data
      },
    ],
  },
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