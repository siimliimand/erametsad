import type { CollectionConfig } from 'payload'

export const Settings: CollectionConfig = {
  slug: 'settings',
  auth: false,
  admin: {
    group: 'Auction',
  },
  fields: [
    {
      name: 'orgName',
      type: 'text',
    },
    {
      name: 'orgRegCode',
      type: 'text',
    },
    {
      name: 'orgAddress',
      type: 'textarea',
    },
    {
      name: 'feePercent',
      type: 'number',
      defaultValue: 3,
      min: 0,
      max: 100,
    },
    {
      name: 'vatPercent',
      type: 'number',
      defaultValue: 22,
    },
    {
      name: 'antiSnipeDurationMinutes',
      type: 'number',
      defaultValue: 5,
    },
    {
      name: 'alapakkumineEnabled',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'sealedRevisionCap',
      type: 'number',
      defaultValue: 3,
    },
    {
      name: 'featureFlags',
      type: 'json',
    },
  ],
}