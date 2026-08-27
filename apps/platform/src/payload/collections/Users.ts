import type { CollectionConfig } from 'payload'

import { decrypt, encrypt, hash } from '../../lib/crypto'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    preview: (doc: Record<string, unknown> | null) => {
      if (!doc?.id) return ''
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const secret = process.env.PAYLOAD_PREVIEW_SECRET ?? ''
      const id: string =
        typeof doc.id === 'string' || typeof doc.id === 'number'
          ? String(doc.id)
          : ''
      return `${appUrl}/api/preview?collection=users&id=${id}&draft=true&secret=${secret}`
    },
  },
  versions: { drafts: true },
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
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
    },
    {
      name: 'authMethod',
      type: 'select',
      defaultValue: 'password',
      options: [
        { label: 'eID', value: 'eid' },
        { label: 'Password', value: 'password' },
      ],
    },
    {
      name: 'isikukoodEncrypted',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'isikukoodIv',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'isikukoodHash',
      type: 'text',
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeChange: [
      (data: { data?: Record<string, unknown> }) => {
        const raw = data.data?.isikukood as string | undefined
        if (!raw) return data

        const result = encrypt(raw)
        return {
          ...data,
          data: {
            ...data.data,
            isikukoodEncrypted: result.encrypted,
            isikukoodIv: result.iv,
            isikukoodHash: hash(raw),
            isikukood: undefined,
          },
        }
      },
    ],
    afterRead: [
      (data: { doc: Record<string, unknown> }) => {
        const encrypted = data.doc.isikukoodEncrypted as string | undefined
        const iv = data.doc.isikukoodIv as string | undefined
        if (!encrypted || !iv) return data

        return {
          ...data,
          doc: {
            ...data.doc,
            isikukood: decrypt(encrypted, iv),
          },
        }
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin' || user?.role === 'superadmin') return true
      return false
    },
  },
}