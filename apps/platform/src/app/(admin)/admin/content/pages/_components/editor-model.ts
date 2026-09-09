import { defaultConfigFor } from './block-defaults'
import type { BuilderBlock } from './builder-types'

import { safeParseBlockConfig } from '@/lib/content/blocks'
import { pageBlockTypes, type PageBlockType } from '@/lib/data/schema'

/**
 * Pure bridge between the builder state and the two payload surfaces of the
 * page editor: the `blocks` form field consumed by `savePageBlocksAction` and
 * the raw JSON escape hatch behind the "Kuva JSON" disclosure.
 */

/** Serializes builder state into the `savePageBlocksAction` form payload. */
export function blocksToPayload(blocks: readonly BuilderBlock[]): string {
  return JSON.stringify(blocks.map((block) => ({ type: block.type, config: block.config })))
}

export type ApplyBlocksResult =
  | { ok: true; blocks: BuilderBlock[] }
  | { ok: false; error: string }

/** Client-side id for unsaved blocks; only used for React keys. */
export function newBlockId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `unsaved-${String(Math.random()).slice(2)}`
}

/** Creates a builder block with the registry default config for its type. */
export function createBlock(type: PageBlockType): BuilderBlock {
  return {
    id: newBlockId(),
    type,
    config: defaultConfigFor(type),
  } as BuilderBlock
}

function blockForEntry(
  type: PageBlockType,
  config: unknown,
  fallbackId: string | undefined,
): BuilderBlock | null {
  const parsed = safeParseBlockConfig(type, config ?? {})
  if (!parsed.success) return null
  return {
    id: fallbackId ?? newBlockId(),
    type,
    config: parsed.data,
  } as BuilderBlock
}

/**
 * Applies the raw JSON from the escape-hatch textarea to the builder state.
 * Every entry must be a known block type with a config that passes the
 * registry schema; previously saved block ids are kept when the type at the
 * same position matches so unsaved drawer edits do not lose their identity.
 */
export function applyBlocksJson(
  raw: string,
  previous: readonly BuilderBlock[],
): ApplyBlocksResult {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Paigutus peab olema korrektne JSON.' }
  }
  if (!Array.isArray(parsedJson)) {
    return { ok: false, error: 'Blokid peavad olema loend.' }
  }
  const blocks: BuilderBlock[] = []
  for (const [index, entry] of parsedJson.entries()) {
    const record = (entry ?? {}) as Record<string, unknown>
    const type = record.type
    if (typeof type !== 'string' || !isBlockType(type)) {
      return { ok: false, error: `Bloki ${String(index + 1)} tüüp on tundmatu.` }
    }
    const previousBlock = index < previous.length ? previous[index] : undefined
    const fallbackId = previousBlock?.type === type ? previousBlock.id : undefined
    const block = blockForEntry(type, record.config, fallbackId)
    if (block === null) {
      return { ok: false, error: `Bloki ${String(index + 1)} sisu ei vasta skeemile.` }
    }
    blocks.push(block)
  }
  return { ok: true, blocks }
}

function isBlockType(value: string): value is PageBlockType {
  return pageBlockTypes.includes(value as PageBlockType)
}
