import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { auctions, bids, users } from '../../schema'
import { UnknownCollectionError } from '../errors'
import { coreCollections, getCollectionConfig } from '../registry'

describe('coreCollections registry', () => {
  it('covers the 15 core collections', () => {
    expect(Object.keys(coreCollections).sort()).toEqual(
      [
        'auction-rights',
        'auction-subscriptions',
        'auctions',
        'audit-entry',
        'autobidders',
        'bids',
        'company-access-request',
        'contract-templates',
        'contracts',
        'leads',
        'notifications',
        'profile',
        'rights-request',
        'settings',
        'users',
      ].sort(),
    )
  })

  it('maps every slug to a table whose columns include the id', () => {
    for (const [slug, config] of Object.entries(coreCollections)) {
      const columns = getTableColumns(config.table)
      expect(columns.id, slug).toBeDefined()
    }
  })

  it('resolves relation aliases to real schema columns', () => {
    const bidsColumns = getTableColumns(bids)
    for (const alias of Object.values(coreCollections.bids.aliases)) {
      expect(alias in bidsColumns, alias).toBe(true)
    }
    const auctionColumns = getTableColumns(auctions)
    for (const alias of Object.values(coreCollections.auctions.aliases)) {
      expect(alias in auctionColumns, alias).toBe(true)
    }
  })

  it('marks only users for the isikukood hook', () => {
    expect(coreCollections.users.isikukood).toBe(true)
    expect(
      Object.entries(coreCollections)
        .filter(([slug, config]) => config.isikukood && slug !== 'users')
        .map(([slug]) => slug),
    ).toEqual([])
  })

  it('marks only contract-templates for the activation hook', () => {
    expect(coreCollections['contract-templates'].templateActivation).toBe(true)
    expect(coreCollections.auctions.templateActivation).toBe(false)
  })

  it('declares the inventoried TEXT-JSON fields', () => {
    expect(coreCollections.auctions.jsonFields.cadastres).toBe('array')
    expect(coreCollections.notifications.jsonFields.payload).toBe('json')
    expect(coreCollections['audit-entry'].jsonFields.before).toBe('json')
    expect(coreCollections['audit-entry'].jsonFields.after).toBe('json')
    expect(coreCollections.settings.jsonFields.featureFlags).toBe('json')
    expect(coreCollections.users.jsonFields).toEqual({})
  })

  it('throws on an unknown collection', () => {
    expect(() => getCollectionConfig('nope')).toThrow(UnknownCollectionError)
  })

  it('uses the users table for the users slug', () => {
    expect(getCollectionConfig('users').table).toBe(users)
    expect(getCollectionConfig('bids').table).toBe(bids)
  })
})
