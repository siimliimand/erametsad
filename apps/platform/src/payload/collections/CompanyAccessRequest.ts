import type { CollectionConfig } from 'payload'

export const CompanyAccessRequest: CollectionConfig = {
  slug: 'company-access-request',
  admin: {
    useAsTitle: 'companyName',
    group: 'Users',
  },
  fields: [
    {
      name: 'regCode',
      type: 'text',
      required: true,
    },
    {
      name: 'companyName',
      type: 'text',
    },
    {
      name: 'requesterName',
      type: 'text',
    },
    {
      name: 'requesterPhone',
      type: 'text',
    },
    {
      name: 'requesterEmail',
      type: 'email',
    },
    {
      name: 'reason',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Held', value: 'held' },
      ],
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'reviewedAt',
      type: 'date',
    },
  ],
}