import type { CollectionConfig } from 'payload'

export const Profile: CollectionConfig = {
  slug: 'profile',
  admin: {
    useAsTitle: 'displayName',
    group: 'Users',
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Private', value: 'private' },
        { label: 'Company', value: 'company' },
      ],
    },
    {
      name: 'approvalStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'company',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
    },
    {
      name: 'companyName',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'company',
      },
    },
    {
      name: 'companyRegCode',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'company',
      },
    },
    {
      name: 'displayName',
      type: 'text',
    },
    {
      name: 'phone',
      type: 'text',
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'superadmin') return true
      return { user: { equals: user.id } }
    },
    create: () => true,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'superadmin') return true
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'superadmin') return true
      return { user: { equals: user.id } }
    },
  },
}