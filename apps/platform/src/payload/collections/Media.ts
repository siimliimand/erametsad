import type { CollectionConfig } from 'payload'

import { beforeChangeHook, afterDeleteHook } from '../hooks/r2Hooks'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    mimeTypes: ['image/*', 'application/pdf'],
    disableLocalStorage: true,
  },
  admin: {
    preview: (doc: Record<string, unknown>) => {
      return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/preview?collection=media&id=${String(doc.id)}&draft=true&secret=${process.env.PAYLOAD_PREVIEW_SECRET ?? ''}`
    },
  },
  versions: { drafts: true },
  hooks: {
    beforeChange: [beforeChangeHook],
    afterDelete: [afterDeleteHook],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'r2Key',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
  ],
  access: {
    read: () => true,
  },
}
