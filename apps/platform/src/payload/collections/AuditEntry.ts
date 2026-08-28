import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access'

export const AuditEntry: CollectionConfig = {
  slug: 'audit-entry',
  auth: false,
  admin: {
    group: 'System',
    listSearchableFields: ['actor', 'action', 'entityType'],
    hidden: ({ user }) => {
      if (user.role === 'admin' || user.role === 'superadmin') return false
      return true
    },
  },
  timestamps: true,
  fields: [
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'action',
      type: 'text',
      required: true,
    },
    {
      name: 'entityType',
      type: 'text',
    },
    {
      name: 'entityId',
      type: 'text',
    },
    {
      name: 'before',
      type: 'json',
    },
    {
      name: 'after',
      type: 'json',
    },
  ],
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
}