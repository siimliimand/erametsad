import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'

export const Notification: CollectionConfig = {
  slug: 'notifications',
  auth: false,
  admin: {
    group: 'System',
    hidden: ({ user }) => {
      if (isAdmin(user as { role?: string })) return false
      return true
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'event',
      type: 'text',
      required: true,
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
      name: 'title',
      type: 'text',
    },
    {
      name: 'body',
      type: 'textarea',
    },
    {
      name: 'payload',
      type: 'json',
    },
    {
      name: 'readAt',
      type: 'date',
    },
    {
      name: 'sentAt',
      type: 'date',
    },
  ],
  access: {
    create: () => false,
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isAdmin(user as { role?: string })) return true
      return { user: { equals: user.id } }
    },
    update: () => false,
    delete: () => false,
  },
}