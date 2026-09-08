import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../_actions/content', () => ({
  restorePageVersionAction: vi.fn(),
}))

import {
  buildBlockDiff,
  parseVersionBlocks,
  type DrawerBlock,
} from '../VersionsDrawer'

function block(type: string, config: unknown): DrawerBlock {
  return { type: type as DrawerBlock['type'], config }
}

describe('buildBlockDiff', () => {
  it('marks identical blocks as same with 1-based ordinals', () => {
    const version = [block('hero', { heading: 'Müü metsa' }), block('text', { body: 'Sisu' })]

    const diff = buildBlockDiff(version, [...version])

    expect(diff.map((row) => row.status)).toEqual(['same', 'same'])
    expect(diff.map((row) => row.ordinal)).toEqual([1, 2])
  })

  it('compares configs by value, not by object identity', () => {
    const version = [block('stats', { items: [{ value: '350+', label: 'müüdud objekti' }] })]
    const current = [block('stats', { items: [{ value: '350+', label: 'müüdud objekti' }] })]

    const diff = buildBlockDiff(version, current)

    expect(diff[0]?.status).toBe('same')
  })

  it('marks a type or a config change at the same position as changed', () => {
    const version = [block('text', { heading: 'Vana', body: 'Sisu' })]
    const typeChange = [block('cta', { heading: 'Uus', cta: { label: 'Kirjuta', href: '/kontakt' } })]
    const configChange = [block('text', { heading: 'Uus', body: 'Sisu' })]

    expect(buildBlockDiff(version, typeChange).map((row) => row.status)).toEqual(['changed'])
    expect(buildBlockDiff(version, configChange).map((row) => row.status)).toEqual(['changed'])
  })

  it('marks version-only tail blocks as removed', () => {
    const version = [block('hero', { heading: 'Pealkiri' }), block('text', { body: 'Kadunud' })]
    const current = [block('hero', { heading: 'Pealkiri' })]

    const diff = buildBlockDiff(version, current)

    expect(diff.map((row) => row.status)).toEqual(['same', 'removed'])
    expect(diff[1]?.versionBlock).toEqual({ type: 'text', config: { body: 'Kadunud' } })
    expect(diff[1]?.currentBlock).toBeNull()
  })

  it('marks current-only tail blocks as added', () => {
    const version = [block('hero', { heading: 'Pealkiri' })]
    const current = [block('hero', { heading: 'Pealkiri' }), block('faq', { items: [] })]

    const diff = buildBlockDiff(version, current)

    expect(diff.map((row) => row.status)).toEqual(['same', 'added'])
    expect(diff[1]?.versionBlock).toBeNull()
    expect(diff[1]?.currentBlock).toEqual({ type: 'faq', config: { items: [] } })
  })

  it('returns no rows when both sides are empty', () => {
    expect(buildBlockDiff([], [])).toEqual([])
  })
})

describe('parseVersionBlocks', () => {
  it('parses a snapshot JSON string into blocks', () => {
    const snapshotJson = JSON.stringify([
      { type: 'hero', config: { heading: 'Pealkiri' } },
      { type: 'text', config: { body: 'Sisu' } },
    ])

    expect(parseVersionBlocks(snapshotJson)).toEqual([
      { type: 'hero', config: { heading: 'Pealkiri' } },
      { type: 'text', config: { body: 'Sisu' } },
    ])
  })

  it('returns no blocks for a blank or malformed payload', () => {
    for (const payload of [null, undefined, 42, '', '   ', '{nope', '{"type":"hero"}']) {
      expect(parseVersionBlocks(payload)).toEqual([])
    }
  })

  it('skips entries with an unknown or missing type', () => {
    const snapshotJson = JSON.stringify([
      { type: 'banner', config: {} },
      { config: { heading: 'Pealkiri' } },
      { type: 'text', config: { body: 'Sisu' } },
    ])

    expect(parseVersionBlocks(snapshotJson)).toEqual([{ type: 'text', config: { body: 'Sisu' } }])
  })

  it('defaults a missing config to an empty object', () => {
    const snapshotJson = JSON.stringify([{ type: 'hero' }])

    expect(parseVersionBlocks(snapshotJson)).toEqual([{ type: 'hero', config: {} }])
  })
})
