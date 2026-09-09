import { describe, expect, it } from 'vitest'

import type { BuilderBlock } from '../builder-types'
import { applyBlocksJson, blocksToPayload, createBlock } from '../editor-model'

import { safeParseBlockConfig } from '@/lib/content/blocks'
import type { PageBlockType } from '@/lib/data/schema'


function block(id: string, type: PageBlockType, config: unknown): BuilderBlock {
  return { id, type, config } as BuilderBlock
}

describe('blocksToPayload', () => {
  it('serializes type and config only, preserving order', () => {
    const blocks = [
      block('a', 'hero', { heading: 'Pealkiri', primaryCta: { label: 'Alusta', href: '/' } }),
      block('b', 'text', { body: 'Sisu' }),
    ]

    expect(blocksToPayload(blocks)).toBe(
      JSON.stringify([
        { type: 'hero', config: { heading: 'Pealkiri', primaryCta: { label: 'Alusta', href: '/' } } },
        { type: 'text', config: { body: 'Sisu' } },
      ]),
    )
  })

  it('serializes an empty builder as an empty block list', () => {
    expect(blocksToPayload([])).toBe('[]')
  })
})

describe('applyBlocksJson', () => {
  const previous = [block('keep-1', 'hero', { heading: 'Vana', primaryCta: { label: 'x', href: '/' } })]

  it('applies a valid payload and keeps ids for same-type positions', () => {
    const result = applyBlocksJson(
      JSON.stringify([{ type: 'hero', config: { heading: 'Uus', primaryCta: { label: 'Alusta', href: '/' } } }]),
      previous,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.blocks[0]?.id).toBe('keep-1')
    expect(result.blocks[0]?.config).toEqual({
      heading: 'Uus',
      overlayStrength: 80,
      primaryCta: { label: 'Alusta', href: '/' },
    })
  })

  it('applies registry defaults to partial configs', () => {
    const result = applyBlocksJson(JSON.stringify([{ type: 'ticker', config: {} }]), [])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.blocks[0]?.config).toEqual({ limit: 4, objectType: 'koik', autoRefreshSeconds: 0 })
  })

  it('rejects malformed JSON, non-lists and unknown types', () => {
    expect(applyBlocksJson('{nope', [])).toEqual({ ok: false, error: 'Paigutus peab olema korrektne JSON.' })
    expect(applyBlocksJson('{"type":"hero"}', [])).toEqual({ ok: false, error: 'Blokid peavad olema loend.' })
    expect(applyBlocksJson(JSON.stringify([{ type: 'banner' }]), [])).toEqual({
      ok: false,
      error: 'Bloki 1 tüüp on tundmatu.',
    })
  })

  it('rejects a config that fails its registry schema', () => {
    const result = applyBlocksJson(JSON.stringify([{ type: 'text', config: {} }]), [])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('Bloki 1 sisu ei vasta skeemile.')
  })
})

describe('createBlock', () => {
  it('starts a ticker with the registry default limit and filters', () => {
    const created = createBlock('ticker')

    expect(created.config).toEqual({ limit: 4, objectType: 'koik', autoRefreshSeconds: 0 })
    expect(safeParseBlockConfig('ticker', created.config).success).toBe(true)
    expect(created.id).not.toBe('')
  })
})
