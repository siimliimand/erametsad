import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

export const AutoBidder: CollectionConfig = {
  slug: 'autobidders',
  admin: {
    useAsTitle: 'id',
    group: 'Auction',
    defaultColumns: ['user', 'auction', 'maxAmount', 'status'],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'auction',
      type: 'relationship',
      relationTo: 'auctions',
      required: true,
    },
    {
      name: 'maxAmount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Expired', value: 'expired' },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation !== 'create') return

        const { user, auction } = data as { user?: string; auction?: string }
        if (!user || !auction) return

        return req.payload
          .find({
            collection: 'autobidders',
            where: {
              and: [
                { user: { equals: user } },
                { auction: { equals: auction } },
                { status: { equals: 'active' } },
              ],
            },
            limit: 1,
          })
          .then((result) => {
            if (result.docs.length > 0) {
              throw new Error('An active autobidder already exists for this user and auction')
            }
          })
      },
    ],
  },
  access: {
    create: ({ req: { user } }) => {
      if (!user) return false
      return true
    },
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isAdmin(user as { role?: string })) return true
      return { user: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isAdmin(user as { role?: string })) return true
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (isAdmin(user as { role?: string })) return true
      return { user: { equals: user.id } }
    },
  },
}