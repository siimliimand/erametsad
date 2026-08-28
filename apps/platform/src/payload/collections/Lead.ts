import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access'

export const Lead: CollectionConfig = {
  slug: 'leads',
  auth: false,
  admin: {
    useAsTitle: 'contactName',
    group: 'CRM',
    listSearchableFields: ['contactName', 'email', 'phone', 'formName'],
  },
  fields: [
    {
      name: 'formName',
      type: 'text',
      required: true,
    },
    {
      name: 'pageSlug',
      type: 'text',
    },
    {
      name: 'contactName',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'cadastr',
      type: 'text',
    },
    {
      name: 'consentAt',
      type: 'date',
      required: true,
    },
    {
      name: 'source',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Contract', value: 'contract' },
        { label: 'Disqualified', value: 'disqualified' },
      ],
    },
    {
      name: 'ipHash',
      type: 'text',
      admin: {
        description: 'Salted SHA-256 of IP address',
      },
    },
    {
      name: 'assignedSpecialist',
      type: 'relationship',
      relationTo: 'specialist',
    },
    {
      name: 'internalComment',
      type: 'textarea',
    },
  ],
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
}