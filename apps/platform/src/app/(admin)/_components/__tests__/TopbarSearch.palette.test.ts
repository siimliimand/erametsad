import { describe, expect, it } from 'vitest'

import { ADMIN_MODULES } from '../../_lib/permissions'
import { PALETTE_GROUPS } from '../TopbarSearch'

describe('TopbarSearch palette coverage', () => {
  it('has one jump target per admin module, in sidebar order', () => {
    const moduleRoots = PALETTE_GROUPS.map((group) => group.routes[0])
    expect(moduleRoots).toEqual(
      ADMIN_MODULES.map((module) => ({ label: module.label, href: module.href })),
    )
  })

  it('covers all 13 module hrefs exactly once', () => {
    const hrefs = PALETTE_GROUPS.flatMap((group) => group.routes.map((route) => route.href))
    for (const module of ADMIN_MODULES) {
      expect(hrefs.filter((href) => href === module.href)).toHaveLength(1)
    }
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('keeps the wizard and template sub-routes', () => {
    const hrefs = PALETTE_GROUPS.flatMap((group) => group.routes.map((route) => route.href))
    expect(hrefs).toContain('/admin/auctions/new')
    expect(hrefs).toContain('/admin/contracts/templates')
  })

  it('labels the CMS module Sisuhaldus', () => {
    const content = PALETTE_GROUPS.find((group) => group.id === 'content')
    expect(content?.label).toBe('Sisuhaldus')
    expect(content?.routes[0]?.href).toBe('/admin/content')
  })
})
