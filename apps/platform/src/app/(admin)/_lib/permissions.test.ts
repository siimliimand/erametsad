import { describe, expect, it } from 'vitest'

import {
  ADMIN_MODULES,
  MODULE_VISIBILITY,
  PermissionDeniedError,
  ROLE_ALLOWED_PERMISSIONS,
  ROLE_DENIED_PERMISSIONS,
  adminPermissions,
  assertCan,
  auctionInScope,
  auctionScope,
  can,
  isStaffRole,
  leadInScope,
  leadScope,
  staffRoles,
  visibleModules,
  type AdminModuleId,
  type AdminPermission,
  type StaffRole,
} from './permissions'

const allowedFor = (role: StaffRole): AdminPermission[] =>
  adminPermissions.filter((permission) => can(role, permission))

const sorted = (permissions: readonly AdminPermission[]): AdminPermission[] =>
  [...permissions].sort()

describe('isStaffRole', () => {
  it('accepts exactly the four staff roles', () => {
    for (const role of ['admin', 'superadmin', 'specialist', 'seller']) {
      expect(isStaffRole(role)).toBe(true)
    }
  })

  it('rejects non-staff and unknown roles', () => {
    for (const role of ['guest', 'private', 'company', '', 'Superadmin', 'admin ']) {
      expect(isStaffRole(role)).toBe(false)
    }
  })
})

describe('permission matrix', () => {
  it('admits admin and superadmin to every permission', () => {
    for (const role of ['admin', 'superadmin'] as const) {
      expect(sorted(allowedFor(role))).toEqual(sorted(adminPermissions))
      expect(ROLE_DENIED_PERMISSIONS[role].size).toBe(0)
    }
  })

  it('gives the specialist its operations scope', () => {
    expect(sorted(allowedFor('specialist'))).toEqual(
      sorted([
        'workspace:view',
        'auctions:read',
        'auctions:write',
        'bids:read',
        'bids:write',
        'underbids:decide',
        'leads:read',
        'leads:write',
        'inquiries:read',
        'inquiries:write',
        'statistics:read',
      ]),
    )
  })

  it('keeps the spec deny-list for the specialist role', () => {
    expect(sorted([...ROLE_DENIED_PERMISSIONS.specialist])).toEqual(
      sorted([
        'auctions:end-manual',
        'auctions:archive',
        'auctions:export',
        'auctions:fee-override',
        'auctions:reassign-specialist',
        'sealed:read',
        'sealed:operate',
        'users:read',
        'users:write',
        'companies:read',
        'companies:write',
        'contracts:read',
        'contracts:write',
        'content:read',
        'content:write',
        'settings:read',
        'settings:write',
        'audit:read',
      ]),
    )
    for (const permission of ROLE_DENIED_PERMISSIONS.specialist) {
      expect(can('specialist', permission)).toBe(false)
    }
  })

  it('keeps the seller read-only plus alapakkumine decisions', () => {
    expect(sorted(allowedFor('seller'))).toEqual(
      sorted(['workspace:view', 'auctions:read', 'bids:read', 'underbids:decide']),
    )
    for (const permission of ROLE_DENIED_PERMISSIONS.seller) {
      expect(can('seller', permission)).toBe(false)
    }
    expect(can('seller', 'underbids:decide')).toBe(true)
  })

  it('partitions every permission into allow or deny for every role', () => {
    for (const role of staffRoles) {
      for (const permission of adminPermissions) {
        const inAllow = ROLE_ALLOWED_PERMISSIONS[role].has(permission)
        const inDeny = ROLE_DENIED_PERMISSIONS[role].has(permission)
        expect(inAllow, `${role}/${permission} allow xor deny`).not.toBe(inDeny)
        expect(can(role, permission), `${role}/${permission} can follows allow`).toBe(inAllow)
      }
    }
  })
})

describe('assertCan', () => {
  it('passes for an allowed permission', () => {
    expect(() => {
      assertCan('specialist', 'auctions:write')
    }).not.toThrow()
    expect(() => {
      assertCan('seller', 'underbids:decide')
    }).not.toThrow()
  })

  it('throws an explicit PermissionDeniedError for a denied write', () => {
    try {
      assertCan('specialist', 'auctions:end-manual')
      expect.unreachable('assertCan must throw for a denied permission')
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError)
      expect((error as PermissionDeniedError).permission).toBe('auctions:end-manual')
      expect((error as PermissionDeniedError).message).not.toBe('')
    }
  })
})

describe('auctionScope', () => {
  it('scopes admins to all lots', () => {
    expect(auctionScope('admin', 'user-1')).toEqual({ kind: 'all' })
    expect(auctionScope('superadmin', 'user-1')).toEqual({ kind: 'all' })
  })

  it('scopes the specialist to lots assigned to that specialist', () => {
    expect(auctionScope('specialist', 'user-1')).toEqual({
      kind: 'assigned-specialist',
      specialistId: 'user-1',
    })
  })

  it('scopes the seller to lots owned by that seller', () => {
    expect(auctionScope('seller', 'user-2')).toEqual({
      kind: 'own-seller',
      sellerId: 'user-2',
    })
  })
})

describe('leadScope', () => {
  it('scopes admins to all leads', () => {
    expect(leadScope('admin', 'user-1')).toEqual({ kind: 'all' })
    expect(leadScope('superadmin', 'user-1')).toEqual({ kind: 'all' })
  })

  it('scopes the specialist to leads assigned to that specialist', () => {
    expect(leadScope('specialist', 'user-1')).toEqual({
      kind: 'assigned-specialist',
      assignedSpecialistId: 'user-1',
    })
  })

  it('gives the seller no lead access', () => {
    expect(leadScope('seller', 'user-2')).toEqual({ kind: 'none' })
  })
})

describe('auctionInScope', () => {
  it('lets an all-scope see any record', () => {
    expect(auctionInScope({ kind: 'all' }, {})).toBe(true)
    expect(auctionInScope({ kind: 'all' }, { specialistId: 'other' })).toBe(true)
  })

  it("rejects a specialist opening another specialist's lot", () => {
    const scope = auctionScope('specialist', 'user-1')
    expect(auctionInScope(scope, { specialistId: 'user-1' })).toBe(true)
    expect(auctionInScope(scope, { specialistId: 'user-9' })).toBe(false)
    expect(auctionInScope(scope, { sellerId: 'user-1' })).toBe(false)
    expect(auctionInScope(scope, {})).toBe(false)
  })

  it('binds the seller to its own lots only', () => {
    const scope = auctionScope('seller', 'user-2')
    expect(auctionInScope(scope, { sellerId: 'user-2' })).toBe(true)
    expect(auctionInScope(scope, { sellerId: 'user-9' })).toBe(false)
    expect(auctionInScope(scope, { specialistId: 'user-2' })).toBe(false)
    expect(auctionInScope(scope, {})).toBe(false)
  })
})

describe('leadInScope', () => {
  it('matches only the assigned specialist for a specialist scope', () => {
    const scope = leadScope('specialist', 'user-1')
    expect(leadInScope(scope, { assignedSpecialistId: 'user-1' })).toBe(true)
    expect(leadInScope(scope, { assignedSpecialistId: 'user-9' })).toBe(false)
    expect(leadInScope(scope, {})).toBe(false)
  })

  it('rejects every lead for the none scope', () => {
    expect(leadInScope({ kind: 'none' }, { assignedSpecialistId: 'user-1' })).toBe(false)
    expect(leadInScope({ kind: 'none' }, {})).toBe(false)
  })

  it('lets an all-scope see any lead', () => {
    expect(leadInScope({ kind: 'all' }, { assignedSpecialistId: 'user-9' })).toBe(true)
    expect(leadInScope({ kind: 'all' }, {})).toBe(true)
  })
})

describe('module visibility map', () => {
  const moduleIds = ADMIN_MODULES.map((module) => module.id)

  it('lists the 13 spec modules once each with Estonian labels', () => {
    expect(moduleIds).toHaveLength(13)
    expect(new Set(moduleIds).size).toBe(13)
    expect(ADMIN_MODULES.map((module) => module.label)).toEqual([
      'Töölaud',
      'Oksjonid',
      'Pakkumised',
      'Sul. avamine',
      'Kasutajad',
      'Ettevõtted',
      'Lepingud',
      'Juhtlõimed',
      'Päringud',
      'Sisu',
      'Statistika',
      'Seaded',
      'Auditlogi',
    ])
  })

  it('shows admins all modules', () => {
    for (const role of ['admin', 'superadmin'] as const) {
      expect(MODULE_VISIBILITY[role].size).toBe(13)
      expect(visibleModules(role).map((module) => module.id)).toEqual(moduleIds)
    }
  })

  it('hides governance modules from the specialist', () => {
    expect([...MODULE_VISIBILITY.specialist].sort()).toEqual(
      ['auctions', 'bids', 'inquiries', 'leads', 'statistics', 'workspace'].sort(),
    )
    for (const hidden of [
      'sealed-opening',
      'users',
      'companies',
      'contracts',
      'content',
      'settings',
      'audit-log',
    ] as const) {
      expect(MODULE_VISIBILITY.specialist.has(hidden)).toBe(false)
    }
  })

  it('shows the seller only its read-only modules', () => {
    expect([...MODULE_VISIBILITY.seller].sort()).toEqual(['auctions', 'bids', 'workspace'].sort())
  })

  it('derives every role map from the permission matrix', () => {
    expect(Object.keys(MODULE_VISIBILITY).sort()).toEqual([...staffRoles].sort())
    const moduleReadPermission: Record<AdminModuleId, AdminPermission> = {
      workspace: 'workspace:view',
      auctions: 'auctions:read',
      bids: 'bids:read',
      'sealed-opening': 'sealed:read',
      users: 'users:read',
      companies: 'companies:read',
      contracts: 'contracts:read',
      leads: 'leads:read',
      inquiries: 'inquiries:read',
      content: 'content:read',
      statistics: 'statistics:read',
      settings: 'settings:read',
      'audit-log': 'audit:read',
    }
    for (const role of staffRoles) {
      const expected = ADMIN_MODULES.filter((module) =>
        can(role, moduleReadPermission[module.id]),
      ).map((module) => module.id)
      expect([...MODULE_VISIBILITY[role]].sort()).toEqual(expected.sort())
    }
  })
})
