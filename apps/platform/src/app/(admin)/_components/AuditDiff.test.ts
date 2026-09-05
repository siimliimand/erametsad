import { describe, expect, it } from 'vitest'

import { diffJson, formatLeafValue, isSecretKey, leafKeyOf, MASKED_VALUE } from './AuditDiff'

describe('isSecretKey', () => {
  it.each([
    'reservePrice',
    'reserve_price',
    'apiToken',
    'refresh_token',
    'password',
    'passwordHash',
    'hashedEmail',
    'isikukood',
    'clientSecret',
    'authTag',
    'auth_tag',
    'iv',
    'encryptionIv',
    'auth_iv',
  ])('marks "%s" as secret', (key) => {
    expect(isSecretKey(key)).toBe(true)
  })

  it.each(['title', 'price', 'finalPriceCents', 'givenName', 'activity', 'divider', 'private0'])(
    'does not mark "%s" as secret',
    (key) => {
      expect(isSecretKey(key)).toBe(false)
    },
  )
})

describe('leafKeyOf', () => {
  it('returns the last path segment', () => {
    expect(leafKeyOf('meta.auth.credentials.token')).toBe('token')
  })
})

describe('formatLeafValue', () => {
  it('formats primitives', () => {
    expect(formatLeafValue('aktiivne', true)).toBe('aktiivne')
    expect(formatLeafValue(42, true)).toBe('42')
    expect(formatLeafValue(true, true)).toBe('true')
    expect(formatLeafValue(null, true)).toBe('')
  })

  it('returns null when the leaf is absent on that side', () => {
    expect(formatLeafValue(undefined, false)).toBeNull()
  })

  it('JSON-encodes objects and arrays', () => {
    expect(formatLeafValue(['a', 'b'], true)).toBe('["a","b"]')
  })

  it('caps very long strings', () => {
    const long = 'x'.repeat(3000)
    expect(formatLeafValue(long, true)).toBe(`${'x'.repeat(2000)}…`)
  })
})

describe('diffJson', () => {
  it('detects changed, added and removed leaves with dot paths', () => {
    const rows = diffJson(
      { status: 'active', minBid: 100, gone: 'x' },
      { status: 'ended', minBid: 100, added: 'y' },
    )
    const byPath = new Map(rows.map((row) => [row.path, row]))
    expect(byPath.get('status')).toMatchObject({ state: 'changed', before: 'active', after: 'ended' })
    expect(byPath.get('minBid')).toMatchObject({ state: 'unchanged', before: '100', after: '100' })
    expect(byPath.get('gone')).toMatchObject({ state: 'removed', before: 'x', after: null })
    expect(byPath.get('added')).toMatchObject({ state: 'added', before: null, after: 'y' })
  })

  it('recurses into nested objects', () => {
    const rows = diffJson({ meta: { owner: 'a', note: 'x' } }, { meta: { owner: 'b', note: 'x' } })
    const byPath = new Map(rows.map((row) => [row.path, row]))
    expect(byPath.get('meta.owner')).toMatchObject({ state: 'changed' })
    expect(byPath.get('meta.note')).toMatchObject({ state: 'unchanged' })
  })

  it('treats arrays as leaf values', () => {
    const rows = diffJson({ tags: ['a'] }, { tags: ['a', 'b'] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ state: 'changed', path: 'tags' })
  })

  it('masks secret leaves on both sides while still recording the change', () => {
    const rows = diffJson({ reservePrice: 100 }, { reservePrice: 200 })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    if (!row) throw new Error('expected one diff row')
    expect(row.state).toBe('changed')
    expect(row.masked).toBe(true)
    expect(row.before).toBe('100')
    expect(row.after).toBe('200')
    expect(MASKED_VALUE).toBe('<salajane>')
  })

  it('masks nested secret keys and leaves normal keys visible', () => {
    const rows = diffJson({ meta: { apiToken: 'a' }, name: 'x' }, { meta: { apiToken: 'b' }, name: 'y' })
    const byPath = new Map(rows.map((row) => [row.path, row]))
    expect(byPath.get('meta.apiToken')?.masked).toBe(true)
    expect(byPath.get('name')?.masked).toBe(false)
  })

  it('handles after-only legacy entries', () => {
    const rows = diffJson(null, { status: 'published' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ state: 'added', before: null, after: 'published' })
  })

  it('returns no rows when both sides are empty', () => {
    expect(diffJson(null, null)).toEqual([])
    expect(diffJson({}, {})).toEqual([])
  })
})
