import { describe, expect, it } from 'vitest'

import {
  MAX_REDIRECT_IMPORT_ITEMS,
  parseRedirectCsv,
  planRedirectCsvUpserts,
  summarizeRedirectItems,
} from './redirects-csv'

const csvHeader = 'from,to,type,active'

describe('parseRedirectCsv', () => {
  it('parses the header row and data rows', () => {
    const parsed = parseRedirectCsv(
      `${csvHeader}\n/vana,/uus,301,jah\n"kampaania 2025","/teenused",302,ei\n`,
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.rows).toEqual([
      { from: '/vana', to: '/uus', type: '301', active: 'jah' },
      { from: 'kampaania 2025', to: '/teenused', type: '302', active: 'ei' },
    ])
  })

  it('requires the header row', () => {
    expect(parseRedirectCsv('/vana,/uus\n')).toMatchObject({ ok: false })
    expect(parseRedirectCsv(`${csvHeader}\n`)).toMatchObject({
      ok: false,
      error: 'Fail ei sisalda ühtegi kirjet.',
    })
  })

  it('enforces the row cap', () => {
    const rows = Array.from(
      { length: MAX_REDIRECT_IMPORT_ITEMS + 1 },
      (_, i) => `/vana-${String(i)},/uus,301,jah`,
    )
    expect(parseRedirectCsv(`${csvHeader}\n${rows.join('\n')}`)).toMatchObject({ ok: false })
  })
})

describe('planRedirectCsvUpserts', () => {
  it('plans creates and updates by `from`', () => {
    const plan = planRedirectCsvUpserts(
      [
        { from: '/uus-tee', to: '/siht', type: '301', active: 'jah' },
        { from: '/vana-tee', to: '/siht-2', type: '302', active: 'ei' },
      ],
      new Map([['/vana-tee', 'existing-1']]),
      new Map(),
    )
    expect(plan.invalid).toEqual([])
    expect(plan.plans).toMatchObject([
      { action: 'create', from: '/uus-tee', to: '/siht', type: '301', active: true },
      { action: 'update', from: '/vana-tee', existingId: 'existing-1', active: false },
    ])
  })

  it('rejects rows breaking the save rules and the hop cap', () => {
    const plan = planRedirectCsvUpserts(
      [
        { from: 'puudub-kaldkriips', to: '/siht', type: '301', active: 'jah' },
        { from: '/ise', to: '/ise', type: '301', active: 'jah' },
        { from: '/kett', to: '/b', type: '301', active: 'jah' },
      ],
      new Map(),
      new Map([
        ['/b', '/c'],
        ['/c', '/d'],
        ['/d', '/e'],
        ['/e', '/f'],
      ]),
    )
    expect(plan.plans).toEqual([])
    expect(plan.invalid.map((item) => item.index)).toEqual([1, 2, 3])
    expect(plan.invalid[2]?.reason).toContain('liiga pikk')
  })

  it('marks duplicate from-paths inside the file invalid', () => {
    const plan = planRedirectCsvUpserts(
      [
        { from: '/a', to: '/x', type: '301', active: 'jah' },
        { from: '/a', to: '/y', type: '301', active: 'jah' },
      ],
      new Map(),
      new Map(),
    )
    expect(plan.plans).toHaveLength(1)
    expect(plan.invalid).toHaveLength(1)
    expect(plan.invalid[0]?.reason).toContain('sama algusteega')
  })
})

describe('summarizeRedirectItems', () => {
  it('counts created, updated and failed', () => {
    expect(
      summarizeRedirectItems([
        { index: 1, from: '/a', to: '/x', outcome: 'created' },
        { index: 2, from: '/b', to: '/x', outcome: 'would-create' },
        { index: 3, from: '/c', to: '/x', outcome: 'updated' },
        { index: 4, from: '/d', to: '/x', outcome: 'invalid' },
        { index: 5, from: '/e', to: '/x', outcome: 'failed' },
      ]),
    ).toEqual({ created: 2, updated: 1, failed: 2 })
  })
})
