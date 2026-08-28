import type { CollectionConfig } from 'payload'

import { statusTransitionHook } from '../../lib/auction/status-transitions'

export const Auction: CollectionConfig = {
  slug: 'auctions',
  admin: {
    useAsTitle: 'title',
    group: 'Auction',
    defaultColumns: ['title', 'status', 'objectType', 'startsAt', 'endsAt'],
  },
  versions: { drafts: true },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identity & Status',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              admin: {
                position: 'sidebar',
              },
            },
            {
              name: 'status',
              type: 'select',
              defaultValue: 'draft',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Active', value: 'active' },
                { label: 'Ended', value: 'ended' },
                { label: 'Appraised', value: 'appraised' },
                { label: 'Unsold', value: 'unsold' },
                { label: 'Contract', value: 'contract' },
                { label: 'Completed', value: 'completed' },
                { label: 'Archived', value: 'archived' },
              ],
            },
            {
              name: 'objectType',
              type: 'select',
              required: true,
              options: [
                { label: 'Raieoigus', value: 'raieoigus' },
                { label: 'Kinnistu', value: 'kinnistu' },
                { label: 'Kiire', value: 'kiire' },
                { label: 'Pakett', value: 'pakett' },
              ],
            },
            {
              name: 'isQuickAuction',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'endYear',
              type: 'number',
              admin: {
                description: 'Harvest year for forestry auctions',
              },
            },
          ],
        },
        {
          label: 'Location',
          fields: [
            {
              name: 'county',
              type: 'relationship',
              relationTo: 'counties',
            },
            {
              name: 'parish',
              type: 'relationship',
              relationTo: 'parishes',
            },
            {
              name: 'address',
              type: 'text',
              admin: {
                description: 'Human-readable location description',
              },
            },
            {
              name: 'coordinates',
              type: 'json',
              admin: {
                description: '{ lat, lng } object',
              },
            },
            {
              name: 'katasterLink',
              type: 'text',
              admin: {
                description: 'URL to Estonian land board cadastral map',
              },
            },
            {
              name: 'metsaregisterLink',
              type: 'text',
              admin: {
                description: 'URL to forest register',
              },
            },
          ],
        },
        {
          label: 'Land & Forest Data',
          fields: [
            {
              name: 'cadastres',
              type: 'array',
              fields: [
                {
                  name: 'cadastreId',
                  type: 'text',
                },
                {
                  name: 'area',
                  type: 'number',
                },
                {
                  name: 'unit',
                  type: 'text',
                },
              ],
            },
            {
              name: 'registryNumbers',
              type: 'array',
              fields: [
                {
                  name: 'number',
                  type: 'text',
                },
              ],
            },
            {
              name: 'species',
              type: 'text',
              hasMany: true,
              admin: {
                description: 'Tree species involved',
              },
            },
            {
              name: 'loggingTypes',
              type: 'array',
              fields: [
                {
                  name: 'code',
                  type: 'text',
                },
              ],
              admin: {
                description: 'Logging method codes',
              },
            },
            {
              name: 'compartments',
              type: 'array',
              fields: [
                {
                  name: 'code',
                  type: 'text',
                },
              ],
              admin: {
                description: 'Forest compartment numbers',
              },
            },
            {
              name: 'notifications',
              type: 'array',
              fields: [
                {
                  name: 'reference',
                  type: 'text',
                },
              ],
              admin: {
                description: 'Forest notification references',
              },
            },
            {
              name: 'deadlines',
              type: 'json',
              admin: {
                description: 'Key dates related to forest work',
              },
            },
          ],
        },
        {
          label: 'Pricing',
          fields: [
            {
              name: 'minBid',
              type: 'number',
              required: true,
              min: 0,
              admin: {
                description: 'Minimum starting bid in EUR',
              },
            },
            {
              name: 'bidStep',
              type: 'number',
              min: 0,
              admin: {
                description: 'Minimum increment in EUR',
              },
            },
            {
              name: 'reservePrice',
              type: 'number',
              min: 0,
              admin: {
                description: 'Reserve price (encrypted at rest for sealed auctions)',
              },
            },
            {
              name: 'feeOverride',
              type: 'number',
              min: 0,
              admin: {
                description: 'Overrides global fee percentage',
              },
            },
            {
              name: 'vatIncluded',
              type: 'checkbox',
              defaultValue: true,
            },
          ],
        },
        {
          label: 'Content',
          fields: [
            {
              name: 'descriptionPublic',
              type: 'richText',
              admin: {
                description: 'Public-facing description',
              },
            },
            {
              name: 'descriptionInternal',
              type: 'richText',
              admin: {
                description: 'Internal notes, not shown publicly',
              },
            },
            {
              name: 'aliasEmail',
              type: 'text',
              admin: {
                description: 'Email alias for this auction',
              },
            },
            {
              name: 'media',
              type: 'relationship',
              relationTo: 'media',
              hasMany: true,
            },
            {
              name: 'files',
              type: 'relationship',
              relationTo: 'media',
              hasMany: true,
            },
          ],
        },
        {
          label: 'Package Fields',
          fields: [
            {
              name: 'packageHeader',
              type: 'text',
              admin: {
                description: 'Table header for pakett auctions',
              },
            },
            {
              name: 'packageRows',
              type: 'json',
              admin: {
                description: 'Dynamic grid data for pakett auctions',
              },
            },
            {
              name: 'packageColumns',
              type: 'array',
              fields: [
                {
                  name: 'column',
                  type: 'text',
                },
              ],
              admin: {
                description: 'Column definitions for pakett auctions',
              },
            },
          ],
        },
        {
          label: 'Relationships',
          fields: [
            {
              name: 'specialist',
              type: 'relationship',
              relationTo: 'specialist',
            },
            {
              name: 'seller',
              type: 'relationship',
              relationTo: 'users',
            },
            {
              name: 'winningBid',
              type: 'text',
              admin: {
                description: 'Bid ID set when auction ends (forward ref — bids collection planned)',
              },
            },
          ],
        },
        {
          label: 'Timestamps',
          fields: [
            {
              name: 'startsAt',
              type: 'date',
              admin: {
                description: 'When auction becomes active',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'endsAt',
              type: 'date',
              admin: {
                description: 'When auction ends (extended by anti-snipe)',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'scheduledAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'activatedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'endedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'completedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'appraisedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'contractAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'archivedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [statusTransitionHook],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) {
        return {
          status: { equals: 'active' },
        }
      }
      const role = (user as { role?: string }).role
      if (role === 'admin' || role === 'superadmin') return true
      if (role === 'specialist') {
        return {
          or: [
            { specialist: { equals: user.id } },
            { status: { equals: 'active' } },
          ],
        }
      }
      return {
        status: { equals: 'active' },
      }
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      return role === 'admin' || role === 'superadmin' || role === 'specialist'
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      if (role === 'admin' || role === 'superadmin') return true
      if (role === 'specialist') {
        return {
          specialist: { equals: user.id },
        }
      }
      return false
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      const role = (user as { role?: string }).role
      return role === 'admin' || role === 'superadmin'
    },
  },
}