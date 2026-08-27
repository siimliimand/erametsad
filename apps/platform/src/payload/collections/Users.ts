import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'guest',
      options: [
        { label: 'Guest', value: 'guest' },
        { label: 'Private', value: 'private' },
        { label: 'Company', value: 'company' },
        { label: 'Seller', value: 'seller' },
        { label: 'Specialist', value: 'specialist' },
        { label: 'Admin', value: 'admin' },
        { label: 'Superadmin', value: 'superadmin' },
      ],
    },
  ],
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin' || user?.role === 'superadmin') return true
      return false
    },
  },
}