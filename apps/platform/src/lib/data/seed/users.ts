/* eslint-disable no-console */
import crypto from 'node:crypto'

import type { CoreRepositories } from '../repositories'

/**
 * Demo users — all share the same password for local dev.
 * password: "demo1234"
 */
const DEMO_USERS: {
  email: string
  name: string
  role: 'guest' | 'private' | 'company' | 'seller' | 'specialist' | 'admin' | 'superadmin'
  isikukood: string
  status: 'active' | 'suspended'
  authMethod: 'password' | 'eid'
  profile?: {
    type: 'private' | 'company'
    approvalStatus?: 'pending' | 'approved' | 'rejected'
    displayName: string
    companyName?: string
    companyRegCode?: string
  }
}[] = [
  {
    email: 'guest@eametsad.ee',
    name: 'Külaline Kasutaja',
    role: 'guest',
    isikukood: '10000000001',
    status: 'active',
    authMethod: 'password',
  },
  {
    email: 'private@eametsad.ee',
    name: 'Eraklient Erika',
    role: 'private',
    isikukood: '10000000002',
    status: 'active',
    authMethod: 'password',
    profile: {
      type: 'private',
      displayName: 'Eraklient Erika',
    },
  },
  {
    email: 'company@eametsad.ee',
    name: 'Firma Esindaja',
    role: 'company',
    isikukood: '10000000003',
    status: 'active',
    authMethod: 'password',
    profile: {
      type: 'company',
      approvalStatus: 'pending',
      displayName: 'Metsa OÜ',
      companyName: 'Metsa OÜ',
      companyRegCode: '12345678',
    },
  },
  {
    email: 'seller@eametsad.ee',
    name: 'Müüja Malle',
    role: 'seller',
    isikukood: '10000000004',
    status: 'active',
    authMethod: 'password',
  },
  {
    email: 'specialist@eametsad.ee',
    name: 'Spetsialist Siim',
    role: 'specialist',
    isikukood: '10000000005',
    status: 'active',
    authMethod: 'password',
  },
  {
    email: 'specialist2@eametsad.ee',
    name: 'Spetsialist Sirje',
    role: 'specialist',
    isikukood: '10000000006',
    status: 'active',
    authMethod: 'password',
  },
  {
    email: 'admin@eametsad.ee',
    name: 'Admin Aare',
    role: 'admin',
    isikukood: '10000000007',
    status: 'active',
    authMethod: 'password',
  },
  {
    email: 'superadmin@eametsad.ee',
    name: 'Superadmin Sander',
    role: 'superadmin',
    isikukood: '10000000008',
    status: 'active',
    authMethod: 'password',
  },
]

// Payload hashed the shared demo password into its auth columns; the D1
// schema keeps password_hash/password_salt. scrypt with a per-user salt
// fills them until the Phase 4 auth port fixes the verification format.
function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { hash, salt }
}

export async function seedUsers(repos: CoreRepositories): Promise<void> {
  const existing = await repos.find({ collection: 'users', limit: 1 })
  if (existing.docs.length > 0) {
    console.log('Users already seeded, skipping')
    return
  }

  for (const u of DEMO_USERS) {
    const { profile, ...userData } = u
    const credentials = hashPassword('demo1234')
    const user = await repos.create({
      collection: 'users',
      data: {
        ...userData,
        passwordHash: credentials.hash,
        passwordSalt: credentials.salt,
      },
    })

    if (profile) {
      await repos.create({
        collection: 'profile',
        data: {
          type: profile.type,
          approvalStatus: profile.approvalStatus ?? 'pending',
          displayName: profile.displayName,
          companyName: profile.companyName,
          companyRegCode: profile.companyRegCode,
          userId: user.id,
        },
      })
    }
  }

  console.log(`Seeded ${String(DEMO_USERS.length)} demo users`)
}
