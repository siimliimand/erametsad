import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

export const AuctionSubscription: CollectionConfig = {
  slug: 'auction-subscriptions',
  admin: {
    useAsTitle: 'id',
    group: 'Auction',
    defaultColumns: ['user', 'channel', 'frequency', 'status'],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'filterJson',
      type: 'json',
      admin: {
        description: 'Saved search filter criteria',
      },
    },
    {
      name: 'channel',
      type: 'select',
      options: [
        { label: 'Email', value: 'email' },
        { label: 'SMS', value: 'sms' },
        { label: 'In App', value: 'in_app' },
      ],
    },
    {
      name: 'frequency',
      type: 'select',
      options: [
        { label: 'Immediate', value: 'immediate' },
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
      ],
    },
    {
      name: 'unsubscribeToken',
      type: 'text',
      unique: true,
      admin: {
        description: 'For email opt-out without auth',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
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