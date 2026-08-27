import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

export const Bid: CollectionConfig = {
  slug: 'bids',
  admin: {
    useAsTitle: 'id',
    group: 'Auction',
    defaultColumns: ['auction', 'user', 'amount', 'type', 'status'],
  },
  fields: [
    {
      name: 'auction',
      type: 'relationship',
      relationTo: 'auctions',
      required: true,
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Sealed', value: 'sealed' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Autobidder', value: 'autobidder' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Leading', value: 'leading' },
        { label: 'Outbid', value: 'outbid' },
        { label: 'Won', value: 'won' },
        { label: 'Lost', value: 'lost' },
        { label: 'Pending Approval', value: 'pending_approval' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'identitySnapshot',
      type: 'textarea',
      admin: {
        description: 'Isikukood or registrikood at bid time',
      },
    },
    {
      name: 'ipHash',
      type: 'text',
      admin: {
        description: 'Salted SHA-256 of IP address',
      },
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      unique: true,
      admin: {
        description: 'For double-submit protection',
      },
    },
  ],
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
      return isAdmin(user as { role?: string })
    },
    delete: () => false,
  },
}